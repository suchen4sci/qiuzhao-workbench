// Personal answers never belong in this registry. See docs/规则来源.md.
const field = (label, aliases = [], options = {}) => ({ label, aliases: [label, ...aliases], ...options });
const groups = {
  practices:{label:'学生实践经验',aliases:[],requiresSection:true,fields:{startTime:field('开始日期',[],{date:true}),endTime:field('结束日期',[],{date:true}),description:field('项目描述')}},
  additional:{label:'附加信息',aliases:['附加问题','从业声明承诺','其他信息'],fields:{recruitmentSource:field('招聘信息渠道',['招聘信息来源渠道','请问您是通过以下哪种渠道了解到此次招聘信息，并投递简历的？']),hobbies:field('兴趣爱好'),publications:field('论文及专利发表情况'),relativeAtEmployer:field('是否有四等亲以内或其他关系（情侣）同仁在本公司？',[],{manual:true})}},
  family:{label:'家庭关系',aliases:['家庭信息','家庭其他成员','家庭情况','主要家庭成员及社会关系'],fields:{name:field('姓名'),relation:field('关系',['与本人关系','称谓']),company:field('工作单位',['工作（学习）单位']),birthDate:field('出生年月',[],{date:true}),position:field('职位',['职务','职务及职称']),phone:field('联系电话',['联系地址/联系电话'])}},
  skills:{label:'计算机技能',aliases:['专业技能','技能','IT技能','IT能力'],fields:{category:field('技能类别'),duration:field('使用时间总计'),name:field('开发语言',['技能名称'],{optionAliases:{'C':['C/C++']}}),level:field('掌握程度',[],{proficiency:true})}},
    intent: {label:'求职意向',aliases:['申请信息'],fields:{annualSalary:field('期望薪酬(年薪)'),otherCities:field('其它期望工作城市',[],{multiple:true}),acceptLocationAdjustment:field('是否接受工作地点调剂'),guangzhouContacts:field('有无亲友在广州'),acceptAdjustment:field('是否接受岗位调剂',['是否接受调剂'],{optionAliases:{'是':['接受'],'否':['不接受']}}),recruitmentSource:field('了解该招聘信息渠道',['简历投递渠道'],{optionAliases:{'官网':['公司官网','官方网站','校招官网']}}),otherTalentPlan:field('是否有申请其他公司人才专项计划？'),arrivalDate:field('到岗时间',[],{date:true}),currentSalaryAmount:field('当前薪资'),currentSalary:field('现月薪(税前)'),appliedRole:field('期望岗位'),applicationCity:field('意向工作城市'),primaryCity:field('期望工作地点1',['期望工作城市第一志愿','期望工作地','期望工作地点'],{optionAliases:{'北京市':['北京']}}),secondaryCity:field('期望工作地点2',['第二志愿城市','期望工作地点二']),secondaryRole:field('第二志愿岗位'),interviewCity:field('可面试城市',[],{optionAliases:{'北京市':['北京']}}),industry:field('期望从事行业'),occupation:field('期望从事职业'),salary:field('期望月薪(税前)',['期望税前月薪','期望薪资']),city:field('期望工作城市',['期望城市'])}},
  basic: { label: '基本信息', aliases: ['个人信息', '基本资料', '个人基本信息', '联系方式', '最高学历', 'basic information', 'personal information'], fields: {
    acceptAdjustment:field('接受调剂',[],{optionAliases:{'是':['接受'],'否':['不接受']}}),seriousIllness:field('重大疾病史（含手术）'),highestDegree:field('最高学位',[],{scopedAliases:['学位'],optionAliases:{'工学硕士':['硕士'],'工学学士':['学士']}}),studyMode:field('学习形式',[],{optionAliases:{'全日制统分统招':['全国普通高等院校全日制'],'全日制':['全国普通高等院校全日制']}}),nationality:field('国籍',['国家/地区']),skillsSummary:field('技能',['精通的知识和技能']),awardsSummary:field('获奖经历'),hobbies:field('兴趣爱好',['特长爱好']),
    researchAchievements:field('何时何地获何种科技、管理成果或发表学术论文（附证书、论文）'),name: field('姓名', ['中文姓名', '真实姓名', 'name', 'full name']), englishName: field('英文名', ['英文姓名', 'english name']),
    gender: field('性别', ['gender', 'sex']), birthDate: field('出生日期', ['生日', '出生年月', '出生日期 (年龄)', 'date of birth'], { date: true }),
    latestMajor:field('最近毕业专业',['最高学历专业'],{scopedAliases:['专业','专业名称']}),workYears:field('工作年限'),
    idType:field('证件类型'),
    nonCompeteRestriction:field('是否存在竞业限制',['是否存在“竞业限制”','是否有竞业限制'],{manual:true}),
    intellectualPropertyRestriction:field('是否存在知识产权限制',['是否存在“知识产权限制”','是否有知识产权限制'],{manual:true}),
    formalWorkExperience:field('是否有正式工作经历',['有无正式工作经历'],{manual:true}),
    isGraduate:field('是否为应届毕业生'),school:field('毕业院校',['毕业学校','最高学历毕业学校']),department:field('最高学历院系'),schoolCity:field('就读院校所在城市',['毕业院校所在城市'],{optionAliases:{'北京市':['北京']}}),sourcePlace:field('生源地（高考时的户籍所在地）',['生源地','入学前户籍所在地'],{optionAliases:{'天津市':['天津']}}),
    phone: field('手机号', ['手机号码', '手机', '联系电话', '联系手机','移动电话', 'mobile', 'phone', 'phone number']),
    email: field('邮箱', ['电子邮箱', '电子邮件', '联系邮箱', 'email', 'e-mail']),
    wechat:field('微信',['微信号']),certificateDate:field('预计获取双证时间',['预计取得双证时间'],{date:true}),
    maritalStatus: field('婚姻状况',['婚否']), graduateType: field('应届/往届'), overseasStudy: field('海外留学经历'),
    postalCode:field('邮编',['邮政编码']),healthStatus:field('健康状况'),diseaseHistory:field('疾病史',['病史']),vision:field('视力',['视力情况']),militaryService:field('是否曾服兵役',['是否服过兵役','是否服兵役']), mailingAddress:field('通讯地址',['通信地址']),
    ethnicity: field('民族'), politicalStatus: field('政治面貌',[],{optionAliases:{'中共党员':['党员'],'共青团员':['团员']}}),
    nativePlace: field('籍贯'), hukouLocation: field('户籍所在地', ['户口所在地']), currentAddress: field('现居地', ['现居住地','目前居住地'],{optionAliases:{'北京市':['北京']}}),
    idNumber: field('身份证号', ['身份证号码', '证件号码'], { manual: true }),
    highestEducation: field('最高学历',['在读学历'],{scopedAliases:['学历'],optionAliases:{'硕士研究生':['硕士'],'博士研究生':['博士']}}),majorCategory:field('在读专业类别'),specialization:field('专业细分方向'),overseasGraduate:field('海外院校毕业'),graduationYear:field('毕业时间（年）'),graduationMonth:field('毕业时间（月）'),undergraduateSchool:field('本科毕业院校'),englishLevel:field('英语等级',['英语证书']),englishScore:field('英语等级成绩',['雅思成绩']),otherLanguageCertificates:field('其他语言能力及等级/分数'), graduationDate: field('毕业时间', ['预计毕业时间','最高学历毕业时间'], { date: true }),
    birthPlace:field('出生地',[],{optionAliases:{'北京':['北京市']}}),growthPlace:field('成长地',[],{optionAliases:{'北京':['北京市']}}),height: field('身高', ['身高cm','身高(厘米)']), weight: field('体重', ['体重kg','体重(公斤)']),
    emergencyContactName: field('紧急联系人', ['紧急联系人姓名']), emergencyPhone: field('紧急联系人电话',['紧急联系方式','紧急联系人手机']),
  } },
  education: { label: '教育经历', aliases: ['教育背景', '教育信息', '教育情况', '学历信息', 'education'], fields: {
    school: field('学校名称', ['毕业院校', '学校', '院校名称', '就读学校', 'school', 'university']),
    level: field('学历', ['教育程度', '学历层次'],{scopedAliases:['最高学历'],optionAliases:{'硕士研究生':['硕士'],'博士研究生':['博士']}}), degree: field('学位', ['获得学位'],{optionAliases:{'工学硕士':['硕士'],'工学学士':['学士']}}), major: field('专业', ['专业名称', '所学专业', 'major'],{optionAliases:{'电子信息科学与技术':['电子信息科学与技术(电子信息类)']}}), majorCategory:field('专业类别',['专业分类']),
    majorDescription:field('专业描述'),majorCode:field('专业代码'),schoolLocation:field('院校所在地',['学校所在地'],{optionAliases:{'北京市':['北京']}}),department: field('学院', ['院系', '院系名称', '所属学院','学院名称']), educationType: field('学习形式', ['培养方式', '教育类型','受教育类型','教育性质'],{optionAliases:{'全日制':['普通全日制'],'普通全日制':['全日制'],'全日制统分统招':['全日制','普通全日制','统招','全国普通高等院校全日制']}}),
    duration:field('学制',['学制（年）'],{unitYears:true}),
    startTime: field('入学时间', ['开始时间', '开始日期', '入学日期', 'start date'], { date: true }),
    endTime: field('毕业时间', ['结束时间', '毕业日期', '结束日期', '预计毕业时间', 'end date'], { date: true }),
    gpa: field('GPA', ['平均绩点', '绩点','成绩（GPA）','成绩(GPA)']), thesis: field('毕业论文/设计/作品'), classRank: field('成绩排名', ['班级排名','专业排名', '专业排名/专业人数', '排名', '排名分位','成绩分位','年级排名','最高学历在校成绩','学习成绩排名'], { rank: true }),
    professionalRank:field('专业成绩排名',[],{rank:true}),
    referenceName:field('证明人'),referencePhone:field('证明人电话'),retake:field('是否有补考记录'),punishment:field('是否接受过处分'),overseas:field('海外工作/学习经验'),position:field('担任职务'),
    researchStudy: field('课题研究',['研究方向或课题描述']), majorCourses: field('主修课程', ['主要课程','专业课程']), supervisor: field('导师', ['导师姓名']), researchDirection: field('研究方向',['专业学习方向/研究方向']),
  } },
  internship: { label: '实习经历', aliases: ['实习经验', '实习信息', '实习/工作经历', '工作/实习经历', '工作经历', 'internship'], fields: {
    industry:field('所在行业',['所属行业']),reportTo:field('汇报对象'),companySize:field('公司规模'),workType:field('工作类型',['工作性质','工作类别']), monthlySalary:field('职位月薪(税前)',['税前月薪','薪资']), hasReference:field('是否有证明人'), referenceName:field('证明人姓名',['证明人']), referenceRelation:field('证明人关系'), referencePosition:field('证明人职务'), referenceCompany:field('证明人单位'), referenceContact:field('证明人联系方式'),referenceSummary:field('证明人/联系方式'),
    company: field('公司名称', ['工作单位', '实习单位', '单位名称', '企业名称','单位', 'company']), department: field('部门', ['所在部门', '实习部门']),
    position: field('职位名称', ['职务', '职位', '岗位', '实习岗位', '担任职务','工作/实习所在部门岗位/职务', 'position']), workLocation:field('工作地点',['实习地点']), companyNature: field('单位性质', ['公司性质', '企业性质']),
    startTime: field('开始时间', ['开始日期', '入职时间', '实习开始时间', 'start date'], { date: true }),
    endTime: field('结束时间', ['结束日期', '离职时间', '实习结束时间', 'end date'], { date: true }),
    description: field('工作内容', ['工作描述', '实习内容', '实习描述', '工作职责', '职责描述','详细描述', 'description']),companyDescription:field('单位介绍'),
  } },
  projects: { label: '项目经历', aliases: ['项目经验', '科研经历', '科研项目', '项目情况', 'projects'], fields: {
    company:field('项目所属单位',['所属公司','项目所属单位名称']),tools:field('开发工具'),achievement:field('项目成果'),name: field('项目名称', ['课题名称', 'project name','实践名称']), role: field('项目角色', ['项目职务','职责','担任角色', '担任职务', '职务', '角色', 'role']),
    startTime: field('开始时间', ['开始日期', '项目开始时间', 'start date'], { date: true }),
    endTime: field('结束时间', ['结束日期', '项目结束时间', 'end date'], { date: true }),
    description: field('项目描述', ['项目内容', '项目简介', '项目介绍', 'description','实践描述','承担主要工作']), responsibilities: field('项目职责', ['项目中职责','个人职责', '本人职责', '职责描述']),
  } },
  campus: { label: '学生工作', aliases: ['校园经历','院校经历', '校园实践', '学生干部','学生干部经历', '社团经历', '在校职务', '校园活动'], fields: {
    name: field('组织名称', ['社团名称', '活动名称', '名称','项目名称']), role: field('担任职务', ['职务', '角色','职务名称','在校职务名称']),
    startTime: field('开始时间', ['开始日期'], { date: true }), endTime: field('结束时间', ['结束日期'], { date: true }),
    activityDescription:field('项目描述'),description: field('工作描述', ['工作内容', '活动描述', '经历描述','职务描述','在校职务描述', '描述', 'description']),
  } },
  awards: { label: '奖励荣誉', aliases: ['奖励信息','荣誉与奖励', '获奖情况', '获奖经历', '奖励情况', '荣誉奖励', 'awards'], fields: {
    scholarship:field('您是否获得过校一等奖学金及以上奖项？'),scholarshipDetails:field('奖学金获奖详情',['请按格式填写获奖名称（格式： XX年XX月XX日获XX单位/机构颁发XX奖项）']),competition:field('您是否获得过ACM、Google、国内国际数学建模大赛等相关权威竞赛二等奖或银奖以上奖项？'),otherAwards:field('其他奖项'),name: field('奖项名称', ['奖励名称','奖励表彰名称', '获奖名称', '荣誉名称','获奖项','奖项']), date: field('获奖时间', ['获奖日期', '颁发时间','奖励表彰日期'], { date: true }),
    issuer: field('颁发单位', ['授予单位', '批准单位','奖励颁发机构名称']), grade: field('奖项等级', ['获奖等级', '奖励等级']),
    scope: field('获奖级别', ['奖励级别', '奖项级别','奖励表彰级别'],{optionAliases:{'省部级':['省区级'],'学校级':['院校级']}}), description: field('其他说明', ['获奖描述', '奖励描述','备注']),
  } },
  languages: { label: '语言能力', aliases: ['外语能力', '语言水平', '外语水平', '英语能力', 'languages'], fields: {
    listeningSpeaking:field('听说'),readingWriting:field('读写'),language:field('语言类型',['语种']), proficiency:field('掌握程度',['语言熟练程度']),
    name: field('考试名称', ['证书名称', '语言考试','语言等级考试'],{optionAliases:{'雅思':['IELTS'],'大学英语六级':['CET6'],'大学英语四级':['CET4']}}), score: field('成绩', ['分数', '考试成绩', '总分','考试分数']),englishLevel:field('英语水平',[],{optionAliases:{'大学英语六级':['大学英语6级（CET6）','大学英语六级（CET6）'],'大学英语四级':['大学英语4级（CET4）','大学英语四级（CET4）']}}),englishScore:field('英语水平具体成绩'),otherLanguages:field('其他外语水平及成绩'),
    date: field('考试时间', ['考试日期'], { date: true }), reportDate: field('报告日期', ['报告时间'], { date: true }),
  } },
  evaluation: { label: '自我评价', aliases: ['自我描述','自我介绍', '个人评价', 'self introduction'], fields: { description: field('自我评价', ['自我描述','自我介绍', '个人评价', '评价内容','内容','self introduction']), hobbies:field('个人爱好',['兴趣爱好']),thesisSummary:field('毕业论文简介',[]) } },
  practice:{label:'其他实践活动',aliases:[],fields:{description:field('社会/校内实践活动'),certificates:field('专业资格证书')}},
  hobbies:{label:'个人爱好',aliases:[],fields:{description:field('个人爱好')}},
  research:{label:'科研成果',aliases:[],fields:{coreMember:field('您是否为国家级重大项目或重点实验室核心成员？'),patents:field('您是否作为主要申请人或参与者获得两项及以上的所学专业相关发明专利？'),highLevelResults:field('您是否有高水平研究结果，论文被ISTP、EI、SCI等收录、参加国际学术会议并专题发言、国际标准组织提案制定者、以第一作者在国际期刊发表论文等情况？')}},
  relatives:{label:'是否有亲属在中国电信集团任职',aliases:[],fields:{employed:field('是否有亲属在电信集团任职')}},
};
groups.intent.fields.referralCode=field('内推码',['推荐码','员工推荐码']);
groups.basic.fields.englishLevel.aliases.push('最高英语等级');
groups.basic.fields.englishScore.aliases.push('最高英语等级成绩');
groups.basic.fields.publicationLevel=field('最高水平文章发表级别（仅限1作或通讯作者）');
groups.basic.fields.highestRank=field('最高专业排名（年级排名）',[],{rank:true});
groups.education.fields.schoolLocation.aliases.push('院校所在城市');
groups.education.fields.duration=field('学制',[],{optionAliases:{'3':['3年','3年制'],'4':['4年','4年制']}});
groups.education.fields.laboratory=field('实验室名称');
groups.education.fields.nationalLaboratory=field('是否国家重点实验室');
groups.education.fields.jointTraining=field('是否联合培养');
groups.internship.fields.hasExperience=field('是否有实习/工作经历');
groups.internship.fields.position.aliases.push('实习/工作岗位');
groups.internship.fields.description.aliases.push('实习/工作内容');
groups.intent.fields.applicationCity.optionAliases={'北京市':['北京']};
groups.basic.fields.referral=field('是否内推');
groups.basic.fields.referralCode=field('如是，请填写推荐人工号');
groups.languages.aliases.push('证书','证书或其他获奖情况');
groups.languages.fields.category=field('类别');
groups.additional.fields.previousEmployer=field('您是否曾经在长江存储及其分子公司任职过？');
groups.additional.fields.employerRelatives=field('您是否有直系/近亲属或与您在生活/财务上有依赖关系的人在长江存储及利益相关方工作？');
groups.additional.fields.recruitmentSource.aliases.push('您从以下哪个渠道了解到长江存储校园招聘信息？');
groups.additional.fields.recruitmentSource.optionAliases={'官网':['长江存储官网/招聘官微','TI校招官网']};
// Semantic aliases used by employer-customized structured application forms.
groups.additional.aliases.push('其他');
groups.basic.fields.referral.aliases.push('是否为TI员工推荐？');
groups.education.fields.majorCategory.aliases.push('您的专业属于');
groups.education.fields.majorCategory.optionAliases={'电子信息类':['理工科']};
groups.education.fields.electronicCompetition=field('是否曾在全国大学生电子设计竞赛（TI杯）中获奖？');
groups.education.fields.otherElectronicCompetition=field('如您参加过TI杯以外的电赛，请在下方填写比赛名称及获奖情况');
groups.intent.fields.interviewCity.aliases.push('期待线下面试城市');
groups.intent.fields.currentCity=field('目前所在城市',[],{optionAliases:{'北京市':['北京']}});
groups.intent.fields.arrivalDate.aliases.push('预计报到时间','报到时间','统一报到时间');
groups.intent.fields.workLocations=field('期待工作地点(多选)',[],{multiple:true});
groups.intent.fields.primaryCity.aliases.push('期待工作地点排序一');
groups.intent.fields.secondaryCity.aliases.push('期待工作地点排序二');
groups.intent.fields.tertiaryCity=field('期待工作地点排序三');
groups.additional.fields.employerRelative=field('是否有亲属受雇于本公司');
function normalize(s) { return String(s || '').toLowerCase().replace(/\(必填\)|（必填）|\(选填\)|（选填）/g, '').replace(/[\s*＊?？:：()（）\[\]【】\-_/]/g, ''); }
function sectionFrom(text) {
  const n = normalize(text).replace(/[0-9一二三四五六七八九十]+$/g, '');
  return Object.entries(groups).find(([, g]) => [g.label, ...g.aliases].some(a => normalize(a) === n))?.[0] || null;
}
function matchField(labels, section) {
  const names = labels.map(normalize).filter(Boolean);
  const candidates = [];
  for (const [groupId, group] of Object.entries(groups)) {
    if(!section&&group.requiresSection)continue;
    if (section && groupId !== section) continue;
    for (const [key, spec] of Object.entries(group.fields)) {
      const aliases=section?[...spec.aliases,...(spec.scopedAliases||[])]:spec.aliases;
      if (aliases.some(a => names.includes(normalize(a)))) candidates.push({ groupId, key, spec });
    }
  }
  if(candidates.length>1){const exact=candidates.filter(c=>c.spec.aliases.some(a=>labels.some(l=>String(l).trim()===a)));if(exact.length===1)return exact[0];}
  return candidates.length === 1 ? candidates[0] : null;
}
groups.intent.fields.salaryMinimum=field('最低薪资',[],{salaryBound:true});
groups.basic.fields.acceptAdjustment.aliases.push('是否接受职位调剂');
groups.basic.aliases.push('最高学历学习成绩');
groups.basic.fields.classTop30=field('综合成绩是否为班级前30%');
groups.research.aliases.push('论文发表');
groups.intent.fields.salaryMaximum=field('最高薪资',[],{salaryBound:true});
groups.intent.fields.city.optionAliases={'北京市':['北京']};

// Exact labels for the legacy Phoenix form; existing section mappings remain intact.
groups.basic.fields.studyMode.aliases.push('培养方式');
groups.basic.fields.department=field('院系');
groups.basic.fields.studyDuration=field('学制');
groups.basic.fields.specialization.aliases.push('研究方向');
groups.basic.fields.mailingAddress.aliases.push('联系地址');
groups.basic.fields.salaryMinimum=field('薪金期望');
groups.basic.fields.selfEvaluation=field('自我评价');
groups.family.fields.currentCity=field('家庭所在地');
groups.additional.fields.languageSummary=field('外语知识');
groups.additional.fields.rankSummary=field('综合排名');
groups.additional.fields.scholarshipSummary=field('奖学金情况');
groups.additional.fields.outstandingStudentCadre=field('优秀学生干部');
groups.additional.fields.relativesAtFifthAcademy=field('有无亲属在五院工作');
groups.additional.fields.hasPassportOrTravelPermit=field('是否有因私护照、港澳台通行证');
groups.additional.fields.appliedGraduateStudy=field('是否已报考研究生');
groups.additional.fields.recruitmentSource.aliases.push('您递交简历的方式');
groups.education.fields.unifiedAdmission=field('是否统招');
groups.education.fields.gaokaoProvince=field('生源地（参加高考省份）');
groups.intent.fields.city.aliases.push('意向工作地');
groups.basic.fields.hasChildren=field('有无子女',['是否有子女'],{optionAliases:{'无':['否'],'有':['是']}});
groups.intent.fields.salaryFloor=field('最低可接受月薪',['薪资低于多少便不会考虑这个机会']);
groups.basic.aliases.push('基础信息');
groups.basic.fields.partyJoinDate=field('入党时间',[],{date:true});
groups.basic.fields.school.aliases.push('最高学历院校');
groups.basic.fields.politicalStatus.optionAliases['中共党员'].push('中国共产党党员');
groups.basic.fields.idType.optionAliases={'身份证':['18位身份证号']};
groups.basic.fields.birthPlaceDetail=field('出生地详细地址');
groups.basic.fields.expectedSalaryMinimum=field('期望薪资范围（税前月薪）',[],{salaryRange:true});
// Definition-list presence declarations preserve earlier labels.
groups.basic.fields.currentAddress.aliases.push('现居住城市');
groups.family.aliases.push('家庭成员');
groups.awards.aliases.push('在校奖励活动');
groups.languages.aliases.push('语言证书');
groups.skills.aliases.push('技能特长');
groups.internship.fields.hasExperience.aliases.push('是否存在实习经历','是否有实习经历/全职工作经验/校内活动或社会实践');
groups.projects.fields.hasExperience=field('是否有项目经历',['是否存在项目经历']);
groups.awards.fields.hasExperience=field('是否有在校奖励活动');
groups.languages.fields.hasAbility=field('是否有英语/其它外语能力');
groups.skills.fields.hasAbility=field('是否有技能特长',['是否有计算机技能']);
groups.employerRelations={label:'亲属声明',aliases:['亲属关系'],fields:{present:field('是否亲属受雇中国移动')}};
groups.basic.fields.partyJoinDate.aliases.push('入党团时间');
groups.basic.fields.hukouCategory=field('户籍类别');
groups.family.fields.name.aliases.push('亲属姓名');
groups.family.fields.relation.aliases.push('与本人关系');
groups.family.fields.company.aliases.push('亲属工作单位');
groups.family.fields.position.aliases.push('亲属职位');
groups.family.fields.gender=field('性别');
groups.family.fields.politicalStatus=field('政治面貌');
groups.family.fields.currentAddress=field('现居住地址');
groups.family.fields.birthDate.aliases.push('出生日期');
module.exports = { groups, normalize, sectionFrom, matchField };


