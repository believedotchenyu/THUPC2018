
let Router = require('koa-router');
let _ = require('lodash');
let path = require('path');
let mzfs = require('mz/fs');
let moment = require('moment');
let qs = require('querystring');
require('should');

const router = module.exports = new Router();

let { Team } = require('../models');
let auth = require('../services/auth');
let tools = require('../services/tools');

router.get('/onlinecontest', auth.loginRequired, async ctx => {
    await ctx.render("onlinecontest", {title: '网络赛', tab: 'onlinecontest'});
});

router.post('/onlinecontest_register', auth.loginRequired, async ctx => {
    auth.assert(moment().isBefore(moment('2018-05-13 00:00')), '网络赛报名已截止');

    ctx.state.user.olcontest_register = true;
    await ctx.state.user.save();
    ctx.state.flash.success = '报名成功';
    await ctx.redirect('back');
});

router.get('/myteam', auth.loginRequired, async ctx => {
    await ctx.render("myteam", {title: '我的队伍', tab: 'team'});
});

router.get('/myteam_modify', auth.loginRequired, async ctx => {
    auth.assert(moment().isBefore(moment('2018-05-05')), '报名已截止');

    await ctx.render("myteam_modify", {title: '修改队伍', tab: 'team'});
});

router.get('/myteam_cancel', auth.loginRequired, async ctx => {
    auth.assert(moment().isBefore(moment('2018-05-05')), '报名已截止');

    let team = await Team.findById(ctx.state.user.team_id);
    auth.assert(team, '未知错误');

    team.info_filled = false;
    await team.save();

    await tools.cleanTeamPoints(team);

    ctx.state.flash.success = '取消成功';
    await ctx.redirect('back');
});

router.get('/myteam_info', auth.loginRequired, async ctx => {
    let team = await Team.findById(ctx.state.user.team_id);
    auth.assert(team, '未知错误');
    let obj = _.pick(team, ['teamname', 'enteamname', 'members', 'experiences', 'info_filled', 'team_status']);
    for(let i = 0; i < obj.members.length; i ++) {
        obj.members[i] = _.omit(team.members[i].toJSON(), ['award_oi_points', 'award_acm_points', 'experiences_points']);
    }
    ctx.body = obj;
});

router.post('/myteam_update', auth.loginRequired, async ctx => {
    let team = await Team.findById(ctx.state.user.team_id);
    auth.assert(team, '未知错误');

    try {
        auth.assert(moment().isBefore(moment('2018-05-05')), '报名已截止');
        
        ctx.request.body.should.have.property('teamname').a.String().and.not.eql('', '没有中文队名');
        ctx.request.body.should.have.property('enteamname').a.String().and.not.eql('', '没有英文队名');
        let teamname = ctx.request.body.teamname;
        let enteamname = ctx.request.body.enteamname;
        auth.assert(teamname.length <= 20, '中文队名长度不能超过20');
        auth.assert(_.trim(teamname) == teamname, '中文队名不能以空白字符开始或结尾');
        await tools.checkCtrlChar(teamname);
        auth.assert(enteamname.length <= 30, '英文队名长度不能超过30');
        auth.assert(_.trim(enteamname) == enteamname, '英文队名不能以空白字符开始或结尾');
        auth.assert(/^[a-zA-Z0-9_ ]+$/.test(enteamname), '英文队名只能包含字母/数字/下划线和空格');
        await tools.checkCtrlChar(enteamname);

        let aready_team = await Team.findOne({teamname: teamname});
        auth.assert(!aready_team || aready_team._id.equals(team._id), '中文队名已存在');
        let en_aready_team = await Team.findOne({enteamname: enteamname});
        auth.assert(!en_aready_team || en_aready_team._id.equals(team._id), '英文队名已存在');

        let members = ctx.request.body.members || [];
        auth.assert(_.isArray(members), '格式不正确');
        auth.assert(members.length >= 1, '至少一个队员');
        auth.assert(members.length <= 3, '最多三个队员');
        for(let m of members) {
            auth.assert(1 <= m.name.length, '姓名太短');
            auth.assert(m.name.length <= 50, '姓名太长');
            await tools.checkCtrlChar(m.name);
            await tools.checkPhoneNumber(m.phone_number);
            auth.assert(1 <= m.school.length, '缺少学校');
            auth.assert(m.school.length <= 100, '学校名称太长');
            await tools.checkCtrlChar(m.school);
            auth.assert(_.includes(['初中', '高中', '大一', '大二', '大三', '大四', '研究生', '其他'], m.grade), '年级不正确');
            auth.assert(_.includes(['S', 'M', 'L', 'XL', 'XXL', 'XXXL'], m.tshirt_size), '衣服尺寸不正确');
            auth.assert(_.includes(['男', '女', '保密'], m.sex), '性别不正确');
            auth.assert(_.includes(['NOI金牌', 'NOI银牌', 'NOI铜牌', 'NOI胸牌', '没参加', 'IOI国家队'], m.award_oi), 'OI奖项不正确');
            auth.assert(_.includes(['ACM/ICPC区域赛金牌', 'ACM/ICPC区域赛银牌', 'ACM/ICPC区域赛铜牌', 'ACM/ICPC区域赛胸牌', '没参加', 'WF拿奖', 'WF入围'], m.award_acm), 'ACM奖项不正确');
            auth.assert(_.isString(m.experiences), '没有竞赛经历');
            auth.assert(m.experiences.length <= 4096, '竞赛经历太长');
            await tools.checkCtrlChar(m.experiences);
        };

        team.teamname = teamname;
        team.enteamname = enteamname;
        team.members = members;
        team.info_filled = true;
        await team.save();

        await tools.cleanTeamPoints(team);

        ctx.body = {
            success: 1
        }
    } catch(e) {
        ctx.body = {
            success: 0,
            msg: e.message
        }
    }
});

router.get('/team/highschool', auth.loginRequired, async ctx => {
    let content = await mzfs.readFile(path.join(__dirname, '..', '..', 'highschool.csv'), 'utf-8');
    let list = _.split(content, '\n').map(x => _.trim(x)).filter(x => x.length>0);
    ctx.body = list;
});
router.get('/team/university', auth.loginRequired, async ctx => {
    let content = await mzfs.readFile(path.join(__dirname, '..', '..', 'university.csv'), 'utf-8');
    let list = _.split(content, '\n').map(x => _.trim(x)).filter(x => x.length>0);
    ctx.body = list;
});

router.get('/myteam/invitations', auth.loginRequired, async ctx => {
    auth.assert(ctx.state.team && ctx.state.team.team_status == 'accepted', '抱歉,你的队伍没有通过审核');
    await ctx.render("invitations", {title: '队伍工具箱', tab: 'teamtools'});
});

router.get('/myteam/invitations_download/:name/:format', auth.loginRequired, async ctx => {
    auth.assert(ctx.state.team && ctx.state.team.team_status == 'accepted', '抱歉,你的队伍没有通过审核');
    auth.assert(_.some(ctx.state.team.members, x => x.name == ctx.params.name), `${ctx.params.name}不是你的队员`);
    let filename = ctx.params.name+'.'+ctx.params.format;
    let filepath = path.join(__dirname, '..', '..', 'invitations', filename);
    auth.assert(await mzfs.exists(filepath), '文件不存在');
    let img = await mzfs.readFile(filepath);
    ctx.set("Content-Disposition", `attachment; filename=${qs.escape(filename)}`);
    ctx.body = img;
});
