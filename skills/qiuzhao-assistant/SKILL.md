---
name: qiuzhao-assistant
description: "Build and operate a privacy-first job-search workspace: onboard a profile, match roles to evidence, tailor resumes to JDs, fill browser applications, and track outcomes. Use for job-search setup, application screening, resume tailoring, web-form assistance, or application follow-up; do not use it for unrelated recruiting tasks."
---

# 秋招 assistant

## 投递看板同步

每次准备申请、保存草稿、确认提交或获知进展后，同步用户现有看板。记录公司、具体岗位、逐岗位状态、校招名额上限、核验日期、进度查询链接和登录后的查询路径。区分已上传、已保存、已预览与已成功提交；同一公司多岗位必须分别说明。仅凭预览、关闭标签页或名额减少不能推断具体岗位提交成功。查询菜单未经核验时标注待核实，保留已有记录与证据，不虚构提交时间。

## 招聘类型与个人配置

先读取使用者在私人工作区确认的招聘类型、毕业窗口、岗位方向、城市排序和排除条件；未提供的偏好保持未知，不内置某个人的答案。
- 用户选择仅校园招聘时，只处理已确认的校招岗位，核对毕业届别，不能用社会招聘替代失效入口。
- 用户选择其他招聘类型时，按其授权范围核验岗位资格；企业同时有多类入口不代表当前岗位符合目标类型。
- 招聘类型或届别不明确时，记录待核实并继续可独立完成的工作。

Community derivative of Job Application Copilot (https://github.com/cong1005/job-application-copilot). Preserve the upstream MIT license. This edition changes browser recovery guidance; the remaining job-search workflow and helpers are inherited.

Turn a user's job-search materials into a reusable, auditable workflow. The skill is designed for public reuse: never assume a particular person's identity, vault path, employer list, resume, or preferences. Keep private job-search data in the user's selected local workspace; the skill package itself must remain free of personal data.

## Modes

Route the request to the smallest useful mode:

1. **Onboarding and workspace setup** — read `references/onboarding.md`, detect an existing Obsidian vault or local Markdown directory, ask for missing preferences, and initialize only missing files.
2. **Profile and field library** — read `references/data-model.md`; capture confirmed facts, source/evidence, sensitivity, validity, and reusable online-application answers.
3. **Company and role screening** — read `references/workflow.md`; parse the resume and JD, apply hard filters first, recommend roles with transparent reasons, and record unknowns instead of guessing.
4. **JD-specific resume tailoring** — read `references/resume-tailoring.md`; map each important JD requirement to real evidence, select a positioning strategy, and produce an auditable tailored draft.
5. **Browser application assistance** — read `references/browser-safety.md`; inspect the live page, map fields to confirmed data, follow the stored automation preferences, and stop at human-control checkpoints.
6. **Resume versioning and rollback** — read `references/advanced-features.md`; create immutable material versions, link them to a JD/application, compare changes, and restore a selected version to a new output path.
7. **Attachment tracking** — read `references/advanced-features.md`; create a private attachment manifest with file hash, version, target portal, upload state, and visible evidence.
8. **Portal field adaptation** — read `references/advanced-features.md`; reuse neutral label aliases and portal quirks without storing personal answers in the adapter registry.
9. **Interview preparation** — read `references/advanced-features.md`; combine the confirmed JD, selected resume version, and linked experience records into a role-specific, evidence-bounded preparation pack.
10. **Application tracking, interview, or review** — read `references/workflow.md`; update the application card, timeline, follow-up queue, and evidence log without promoting an earlier stage into a later result.

If several modes are requested, use this order: onboarding → profile/fields → screening → tailoring → versioning/attachments → browser filling → interview preparation → tracking/review.

For versioning, attachments, portal adapters, or interview preparation, read `references/advanced-features.md` at the point the mode is selected. Keep generated versions, manifests, adapters, and interview packs in the user's private workspace, not in this public skill package.

## First-use contract

Before the first real application action, complete onboarding. Ask the user in plain language for:

- the workspace location: an existing Obsidian vault, an existing Markdown folder, or a new local folder;
- which source files may be read, such as a master resume, project notes, certificates, portfolio, or transcripts;
- target graduation window, locations, role families, industries, work-authorization constraints, and hard exclusions;
- browser automation preferences: automatic draft save, safe checkbox selection, file-upload policy, and the user's preferred level of review;
- whether the user wants each final submission confirmed interactively.

Record these choices in the private workspace configuration. A global preference is not permission to expose private data, bypass a login/CAPTCHA/OTP, or submit a new application without an action-time confirmation for the named employer and role.

Use `scripts/init_job_workspace.py` when a new local Markdown workspace is requested. When an existing vault is selected, map to its existing folders and update narrowly; do not create a second parallel database unless the user explicitly asks for migration or separation.

## Non-negotiable operating rules

1. **Privacy by default.** Never place names, contact details, identity numbers, grades, family information, credentials, attachments, or live application records in the public skill package, generated examples, logs intended for GitHub, or browser prompts beyond the current task.
2. **Evidence before claims.** Use `confirmed`, `user-confirmed`, `source-verified`, `needs-confirmation`, and `unknown` states. Do not invent metrics, dates, rankings, responsibilities, company facts, eligibility, or application results.
3. **Separate stages.** Distinguish portal existence, job visibility, application openness, draft save, submission, assessment completion, interview scheduling, interview completion, offer, rejection, and closure. A completed assessment is not a pass; a saved draft is not a submission.
4. **Use official sources when available.** Keep official JD evidence separate from third-party leads, stale pages, and user recollection. Record the source URL and retrieval date.
5. **Preserve user control.** Login, CAPTCHA, hCaptcha/reCAPTCHA, OTP/2FA, unclear sensitive questions, brittle school/major selectors, and final submission require the user or an explicit handoff. Never ask the user to paste passwords or one-time codes into notes.
6. **Tailor from truth.** Reorder, compress, and rephrase the user's verified experience for a JD; do not manufacture a project, tool, result, job title, score, or keyword match.
7. **Log meaningful changes.** After a screening decision, material edit, save, upload, submission, assessment, interview, offer, rejection, or blocker, update the relevant private record and changelog. Do not copy private records into the repository.

## Tool routing

### 可配置的多岗位申请策略

先查明企业当期允许申请的岗位上限。使用者可选择只准备一个岗位、准备多个匹配岗位，或在匹配充分时准备到上限；把选择保存在私人配置中，不默认所有人都需要投满。
- 阅读当期官网招聘须知、FAQ、岗位申请页或本人账户提示，记录总上限、剩余名额、已申请数量、志愿顺序、岗位互斥、跨批次或校招/实习共享名额、撤回后是否恢复名额，以及证据链接与日期。
- 区分“可申请多个岗位”“多个城市”“顺序志愿”和“可同时进入多个流程”。不能根据招聘系统品牌推断企业配置；未查到上限时标为未知，不能假定无限制或通过实际提交试探。
- 已知上限后，优先选择符合本人毕业届别、岗位方向、城市排序的不同岗位，按匹配度和使用者选择的申请策略准备岗位；没有足够合适岗位则如实说明，不为凑数选择不合适岗位、社招或重复岗位。
- 遵循当前提交授权。仅准备阶段把每个岗位填至最终提交前，分别保存证据，不能把草稿数计为已投递；用户要求每家公司处理完再切换时，先完成该公司的上限核查和合适岗位准备。
- 共享简历或申请页面可能互相覆盖；保留各岗位独立链接与字段快照，核验职位名、城市、志愿顺序及附件，不能以多个浏览器标签代替多个已保存申请。
- 用户新提供的企业内推码写入私人知识库，并覆盖该企业尚未提交表单中旧链接自动带入的码；在最终预览核验实际码值。已提交申请是否可追溯修改须读官网或本人账户证据，不通过重复投递变更来源，也不把一家企业内推码复制给其他公司。
- 同一公司新增岗位可能继承在线字段但不继承附件，须逐岗位检查。上传后等待解析结束再恢复被清空的毕业年月、学历、成绩分位、研究方向等；必填确认框即使显示勾选也要以正常预览校验为准。无独立保存按钮时，记录当前预览及本地快照，明确其不代表服务器已保存申请。

### 表单顺序与纠错记录

- 用户补充信息后，先更新私人知识库中对应字段及旧偏好，再逐项修正当前公司的表单。按当前公司的栏目顺序填写、校验、保存并复查，完成至最终确认前再切换下一家公司；若必填未知项确实阻断，记录具体字段后继续独立工作。
- 区分籍贯、目前户口所在地和现居地；“户口同身份证”只映射到本人确认的身份证地址，不将籍贯当户籍。详细地址仅在目标字段需要时填写。
- 区分排序志愿和岗位可选城市：多个志愿按用户最新优先级分别填写；单选城市选择岗位实际提供的最高优先城市，不继续沿用已被覆盖的“仅限某一城市”。
- 排名分位按用户确认值映射到包含该值的现有档位，不得映射到更优排名。没有准确档位时优先“其他”并补充原值。
- 招聘方可见字段只填写该字段所需的本人信息。网站选项映射、工具限制、自动化过程、待办及核验说明仅写入私人操作日志；尤其不得把排名及“网站档位”等操作备注放入主修课程、工作职责或自我评价。最终预览前检查并清除这类误填。
- 项目描述包含起止年月不代表独立日期控件已填写。逐条检查实习和项目的开始、结束日期；只读日期框通过日历选择。按私人知识库既定精度规则处理年月，不能把占位日当真实日期；保存并重新加载后，在新预览核对每条记录的起止日期。
- 只读籍贯或地区输入框通常为级联选择器，点击后选择省、市、区县并复查；不移除readonly或强写DOM值。将已验证的页面问题与恢复方法记入私人知识库，skill只保留可复用操作规则。
- 同一表单可能同时保留隐藏学历栏；定位重复学校/专业框时先限定可见元素，再按栏目匹配，避免用包含隐藏控件的索引。上传控件可能位于iframe，应进入对应附件栏目框架并核验文件记录。
- 附件超过网站大小限制时保留原件，另存压缩副本；保持页数、内容和顺序，逐页检查可读性后上传。核验发现简历与正式成绩单冲突时，记录冲突并向用户询问，不能把冲突值默认为已核验。

- For live browser filling, prefer reliable Playwright-style element actions, then targeted keyboard recovery, then visual interaction when needed; follow the recovery and verification rules in `references/browser-safety.md`. Use only capabilities exposed by the current browser tool. If `browser-rpa-fill` is available, use it for audited field mapping and evidence capture; otherwise use the host's browser tool and preserve the same checkpoints.
- For file-level version snapshots or attachment hashes, use the scripts linked from `references/advanced-features.md`. These scripts only operate on explicitly supplied local paths; they do not upload, submit, or delete application data.
- For formal DOCX/PDF resume creation, route to a document/resume skill if available after producing the tailored content and audit map. Do not treat a Markdown draft as a verified PDF artifact without rendering or opening it.
- For job-board research, prefer official employer pages or a purpose-built connector. If live access is unavailable, label the result as unverified and do not present it as an open application.

## Mandatory attachment check before every save

- Before every manual save or submission, inspect the actual resume attachment and every required supporting file. Confirm the intended filename, version, and its association with the current resume/application. Parsing success, populated fields, a local file path, and a 100% completeness score are not attachment evidence.
- After saving, reopen the saved record and verify that the actual attachment remains available by its filename, preview/download link, or a persisted attachment record. Record the evidence in the private application log. Distinguish draft attachment persistence from attachment delivery with a submitted application.
- If upload reparses or replaces fields, first back up the populated form, upload once, restore affected fields, and verify both fields and attachments. Do not repeatedly upload without investigating the concrete cause. An autosave that occurs before verification must remain marked unverified.
- If an attachment is missing or its persistence cannot be verified, do not mark the application ready or complete and do not proceed to final submission. Report the precise unresolved attachment state and continue diagnosis within authorization.

## Completion report

End each run with a concise report containing: what was created or updated, what was screened or filled, the current evidence-backed status, unresolved fields or blockers, external actions still requiring the user, and the next recommended action. Never report “submitted” without explicit confirmation evidence.
