// Personal answers never belong in this registry. See docs/规则来源.md.
const field = (label, aliases = [], options = {}) => ({ label, aliases: [label, ...aliases], ...options });
const groups = {
  additional:{label:'附加信息',aliases:['附加问题','从业声明承诺'],fields:{recruitmentSource:field('招聘信息渠道',['招聘信息来源渠道','请问您是通过以下哪种渠道了解到此次招聘信息，并投递简历的？']),hobbies:field('兴趣爱好'),publications:field('论文及专利发表情况')}},
  family:{label:'家庭关系',aliases:['家庭信息','家庭其他成员','家庭情况'],fields:{name:field('姓名'),relation:field('关系',['与本人关系']),company:field('工作单位',['工作（学习）单位']),position:field('职位',['职务','职务及职称']),phone:field('联系电话')}},
  skills:{label:'计算机技能',aliases:['专业技能','技能','IT技能','IT能力'],fields:{category:field('技能类别'),duration:field('使用时间总计'),name:field('开发语言',['技能名称'],{optionAliases:{'C':['C/C++']}}),level:field('掌握程度')}},
    intent: {label:'求职意向',aliases:[],fields:{annualSalary:field('期望薪酬(年薪)'),otherCities:field('其它期望工作城市',[],{multiple:true}),acceptLocationAdjustment:field('是否接受工作地点调剂'),guangzhouContacts:field('有无亲友在广州'),acceptAdjustment:field('是否接受岗位调剂'),recruitmentSource:field('了解该招聘信息渠道',[],{optionAliases:{'官网':['公司官网','官方网站']}}),otherTalentPlan:field('是否有申请其他公司人才专项计划？'),arrivalDate:field('到岗时间',[],{date:true}),currentSalary:field('现月薪(税前)'),applicationCity:field('意向工作城市'),primaryCity:field('期望工作地点1',['期望工作城市第一志愿','期望工作地'],{optionAliases:{'北京市':['北京']}}),secondaryCity:field('期望工作地点2',['第二志愿城市']),secondaryRole:field('第二志愿岗位'),interviewCity:field('可面试城市'),industry:field('期望从事行业'),occupation:field('期望从事职业'),salary:field('期望月薪(税前)',['期望税前月薪']),city:field('期望工作城市')}},
  basic: { label: '基本信息', aliases: ['个人信息', '基本资料', '个人基本信息', '联系方式', '最高学历', 'basic information', 'personal information'], fields: {
    name: field('姓名', ['中文姓名', '真实姓名', 'name', 'full name']), englishName: field('英文名', ['英文姓名', 'english name']),
    gender: field('性别', ['gender', 'sex']), birthDate: field('出生日期', ['生日', '出生年月', '出生日期 (年龄)', 'date of birth'], { date: true }),
    latestMajor:field('最近毕业专业'),workYears:field('工作年限'),
    idType:field('证件类型'),
    nonCompeteRestriction:field('是否存在竞业限制',['是否存在“竞业限制”','是否有竞业限制'],{manual:true}),
    intellectualPropertyRestriction:field('是否存在知识产权限制',['是否存在“知识产权限制”','是否有知识产权限制'],{manual:true}),
    formalWorkExperience:field('是否有正式工作经历',['有无正式工作经历'],{manual:true}),
    isGraduate:field('是否为应届毕业生'),school:field('毕业院校',['毕业学校']),department:field('最高学历院系'),schoolCity:field('就读院校所在城市',['毕业院校所在城市'],{optionAliases:{'北京市':['北京']}}),sourcePlace:field('生源地（高考时的户籍所在地）',['生源地','入学前户籍所在地'],{optionAliases:{'天津市':['天津']}}),
    phone: field('手机号', ['手机号码', '手机', '联系电话', '联系手机','移动电话', 'mobile', 'phone', 'phone number']),
    email: field('邮箱', ['电子邮箱', '电子邮件', '联系邮箱', 'email', 'e-mail']),
    maritalStatus: field('婚姻状况',['婚否']), graduateType: field('应届/往届'), overseasStudy: field('海外留学经历'),
    postalCode:field('邮编',['邮政编码']),healthStatus:field('健康状况'), mailingAddress:field('通讯地址',['通信地址']),
    ethnicity: field('民族'), politicalStatus: field('政治面貌'),
    nativePlace: field('籍贯'), hukouLocation: field('户籍所在地', ['户口所在地']), currentAddress: field('现居地', ['现居住地','目前居住地'],{optionAliases:{'北京市':['北京']}}),
    idNumber: field('身份证号', ['身份证号码', '证件号码'], { manual: true }),
    highestEducation: field('最高学历',['在读学历']),majorCategory:field('在读专业类别'),specialization:field('专业细分方向'),overseasGraduate:field('海外院校毕业'),graduationYear:field('毕业时间（年）'),graduationMonth:field('毕业时间（月）'),undergraduateSchool:field('本科毕业院校'),englishLevel:field('英语等级'),englishScore:field('英语等级成绩'),otherLanguageCertificates:field('其他语言能力及等级/分数'), graduationDate: field('毕业时间', ['预计毕业时间'], { date: true }),
    birthPlace:field('出生地',[],{optionAliases:{'北京':['北京市']}}),growthPlace:field('成长地',[],{optionAliases:{'北京':['北京市']}}),height: field('身高', ['身高cm','身高(厘米)']), weight: field('体重', ['体重kg','体重(公斤)']),
    emergencyContactName: field('紧急联系人', ['紧急联系人姓名']), emergencyPhone: field('紧急联系人电话'),
  } },
  education: { label: '教育经历', aliases: ['教育背景', '教育信息', '教育情况', '学历信息', 'education'], fields: {
    school: field('学校名称', ['毕业院校', '学校', '院校名称', '就读学校', 'school', 'university']),
    level: field('学历', ['教育程度', '学历层次'],{optionAliases:{'硕士研究生':['硕士'],'博士研究生':['博士']}}), degree: field('学位', ['获得学位'],{optionAliases:{'工学硕士':['硕士'],'工学学士':['学士']}}), major: field('专业', ['专业名称', '所学专业', 'major'],{optionAliases:{'电子信息科学与技术':['电子信息科学与技术(电子信息类)']}}), majorCategory:field('专业类别',['专业分类']),
    majorDescription:field('专业描述'),schoolLocation:field('院校所在地'),department: field('学院', ['院系', '院系名称', '所属学院','学院名称']), educationType: field('学习形式', ['培养方式', '教育类型','受教育类型','教育性质'],{optionAliases:{'全日制':['普通全日制'],'普通全日制':['全日制'],'全日制统分统招':['全日制','普通全日制','统招','全国普通高等院校全日制']}}),
    startTime: field('入学时间', ['开始时间', '开始日期', '入学日期', 'start date'], { date: true }),
    endTime: field('毕业时间', ['结束时间', '毕业日期', '结束日期', '预计毕业时间', 'end date'], { date: true }),
    gpa: field('GPA', ['平均绩点', '绩点','成绩(GPA)']), thesis: field('毕业论文/设计/作品'), classRank: field('成绩排名', ['专业排名', '专业排名/专业人数', '排名', '排名分位','年级排名','最高学历在校成绩','学习成绩排名'], { rank: true }),
    referenceName:field('证明人'),referencePhone:field('证明人电话'),retake:field('是否有补考记录'),punishment:field('是否接受过处分'),overseas:field('海外工作/学习经验'),position:field('担任职务'),
    researchStudy: field('课题研究',['研究方向或课题描述']), majorCourses: field('主修课程', ['主要课程']), supervisor: field('导师', ['导师姓名']), researchDirection: field('研究方向'),
  } },
  internship: { label: '实习经历', aliases: ['实习经验', '实习信息', '实习/工作经历', '工作/实习经历', '工作经历', 'internship'], fields: {
    workType:field('工作类型',['工作性质','工作类别']), monthlySalary:field('职位月薪(税前)',['税前月薪']), hasReference:field('是否有证明人'), referenceName:field('证明人姓名'), referenceRelation:field('证明人关系'), referencePosition:field('证明人职务'), referenceCompany:field('证明人单位'), referenceContact:field('证明人联系方式'),referenceSummary:field('证明人/联系方式'),
    company: field('公司名称', ['工作单位', '实习单位', '单位名称', '企业名称','单位', 'company']), department: field('部门', ['所在部门', '实习部门']),
    position: field('职位名称', ['职务', '职位', '岗位', '实习岗位', '担任职务','工作/实习所在部门岗位/职务', 'position']), companyNature: field('单位性质', ['公司性质', '企业性质']),
    startTime: field('开始时间', ['开始日期', '入职时间', '实习开始时间', 'start date'], { date: true }),
    endTime: field('结束时间', ['结束日期', '离职时间', '实习结束时间', 'end date'], { date: true }),
    description: field('工作内容', ['工作描述', '实习内容', '实习描述', '工作职责', '职责描述','详细描述', 'description']),companyDescription:field('单位介绍'),
  } },
  projects: { label: '项目经历', aliases: ['项目经验', '科研经历', '科研项目', '项目情况', 'projects'], fields: {
    name: field('项目名称', ['课题名称', 'project name','实践名称']), role: field('项目角色', ['担任角色', '担任职务', '职务', '角色', 'role']),
    startTime: field('开始时间', ['开始日期', '项目开始时间', 'start date'], { date: true }),
    endTime: field('结束时间', ['结束日期', '项目结束时间', 'end date'], { date: true }),
    description: field('项目描述', ['项目内容', '项目简介', '项目介绍', 'description','实践描述','承担主要工作']), responsibilities: field('项目职责', ['个人职责', '本人职责', '职责描述']),
  } },
  campus: { label: '学生工作', aliases: ['校园经历', '校园实践', '学生干部', '社团经历', '在校职务', '校园活动'], fields: {
    name: field('组织名称', ['社团名称', '活动名称', '名称']), role: field('担任职务', ['职务', '角色','职务名称','在校职务名称']),
    startTime: field('开始时间', ['开始日期'], { date: true }), endTime: field('结束时间', ['结束日期'], { date: true }),
    description: field('工作描述', ['工作内容', '活动描述', '经历描述','职务描述','在校职务描述', '描述', 'description']),
  } },
  awards: { label: '奖励荣誉', aliases: ['奖励信息','荣誉与奖励', '获奖情况', '获奖经历', '奖励情况', '荣誉奖励', 'awards'], fields: {
    scholarship:field('您是否获得过校一等奖学金及以上奖项？'),scholarshipDetails:field('奖学金获奖详情',['请按格式填写获奖名称（格式： XX年XX月XX日获XX单位/机构颁发XX奖项）']),competition:field('您是否获得过ACM、Google、国内国际数学建模大赛等相关权威竞赛二等奖或银奖以上奖项？'),otherAwards:field('其他奖项'),name: field('奖项名称', ['奖励名称','奖励表彰名称', '获奖名称', '荣誉名称','获奖项','奖项']), date: field('获奖时间', ['获奖日期', '颁发时间','奖励表彰日期'], { date: true }),
    issuer: field('颁发单位', ['授予单位', '批准单位','奖励颁发机构名称']), grade: field('奖项等级', ['获奖等级', '奖励等级']),
    scope: field('获奖级别', ['奖励级别', '奖项级别','奖励表彰级别'],{optionAliases:{'省部级':['省区级'],'学校级':['院校级']}}), description: field('其他说明', ['获奖描述', '奖励描述','备注']),
  } },
  languages: { label: '语言能力', aliases: ['外语能力', '语言水平', '外语水平', '英语能力', 'languages'], fields: {
    language:field('语言类型',['语种']), proficiency:field('掌握程度',['语言熟练程度']),
    name: field('考试名称', ['证书名称', '语言考试']), score: field('成绩', ['分数', '考试成绩', '总分']),englishLevel:field('英语水平',[],{optionAliases:{'大学英语六级':['大学英语6级（CET6）','大学英语六级（CET6）'],'大学英语四级':['大学英语4级（CET4）','大学英语四级（CET4）']}}),englishScore:field('英语水平具体成绩'),otherLanguages:field('其他外语水平及成绩'),
    date: field('考试时间', ['考试日期'], { date: true }), reportDate: field('报告日期', ['报告时间'], { date: true }),
  } },
  evaluation: { label: '自我评价', aliases: ['自我介绍', '个人评价', 'self introduction'], fields: { description: field('自我评价', ['自我介绍', '个人评价', '评价内容','self introduction']) } },
  practice:{label:'其他实践活动',aliases:[],fields:{description:field('社会/校内实践活动'),certificates:field('专业资格证书')}},
  hobbies:{label:'个人爱好',aliases:[],fields:{description:field('个人爱好')}},
  research:{label:'科研成果',aliases:[],fields:{coreMember:field('您是否为国家级重大项目或重点实验室核心成员？'),patents:field('您是否作为主要申请人或参与者获得两项及以上的所学专业相关发明专利？'),highLevelResults:field('您是否有高水平研究结果，论文被ISTP、EI、SCI等收录、参加国际学术会议并专题发言、国际标准组织提案制定者、以第一作者在国际期刊发表论文等情况？')}},
  relatives:{label:'是否有亲属在中国电信集团任职',aliases:[],fields:{employed:field('是否有亲属在电信集团任职')}},
};
function normalize(s) { return String(s || '').toLowerCase().replace(/\(必填\)|（必填）|\(选填\)|（选填）/g, '').replace(/[\s*＊?？:：()（）\[\]【】\-_/]/g, ''); }
function sectionFrom(text) {
  const n = normalize(text).replace(/[0-9一二三四五六七八九十]+$/g, '');
  return Object.entries(groups).find(([, g]) => [g.label, ...g.aliases].some(a => normalize(a) === n))?.[0] || null;
}
function matchField(labels, section) {
  const names = labels.map(normalize).filter(Boolean);
  const candidates = [];
  for (const [groupId, group] of Object.entries(groups)) {
    if (section && groupId !== section) continue;
    for (const [key, spec] of Object.entries(group.fields)) {
      if (spec.aliases.some(a => names.includes(normalize(a)))) candidates.push({ groupId, key, spec });
    }
  }
  if(candidates.length>1){const exact=candidates.filter(c=>c.spec.aliases.some(a=>labels.some(l=>String(l).trim()===a)));if(exact.length===1)return exact[0];}
  return candidates.length === 1 ? candidates[0] : null;
}
module.exports = { groups, normalize, sectionFrom, matchField };
