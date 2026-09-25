# 秋招的仓库

秋招 Assistant · `qiuzhao-assistant`

`qiuzhao-assistant` is a portable Codex skill for turning a job search into a private, evidence-backed workflow.

It helps users:

- onboard a profile and create a local Markdown/Obsidian workspace;
- maintain reusable application fields and atomic experience records;
- screen companies and roles against a resume and stated preferences;
- tailor a resume or application answer to a specific JD without inventing experience;
- manage immutable resume versions, change maps, and safe rollback copies;
- track attachment versions, exact upload targets, hashes, and visible upload results;
- reuse recruitment-site field adapters without mixing portal knowledge with personal data;
- inspect and fill browser forms with configurable automation preferences;
- generate interview preparation packs from the JD, selected resume version, and linked experience evidence;
- track applications, assessments, interviews, offers, rejections, follow-ups, and review notes.

The package contains workflow instructions and neutral templates only. It does not contain a person's resume, identity data, job records, attachments, credentials, browser session, or employer-specific private notes.

## Install

Copy this directory into the Codex skills directory used by your installation, for example:

```text
~/.codex/skills/qiuzhao-assistant/
```

Then invoke it explicitly with:

```text
Use $qiuzhao-assistant to onboard my job-search profile.
```

Automatic discovery is enabled by default. A host may expose the skill differently depending on its skill configuration.

## Quick start

1. Invoke the skill for onboarding.
2. Choose an existing Obsidian vault, an existing Markdown folder, or a new local folder.
3. Review the generated `00-system/settings.md` and confirm locations, role families, constraints, source files, and automation preferences.
4. Add a master resume and atomic experience records.
5. Provide a JD or company list for screening and role recommendations.
6. Ask for a JD-specific resume variant and create a named version.
7. Generate an attachment manifest before uploading files.
8. Ask for an interview preparation pack after the JD and resume version are confirmed.
9. Open the named portal in a browser when you are ready to fill it.

The included initializer can create a blank scaffold:

```bash
python3 scripts/init_job_workspace.py /path/to/private/job-search-workspace
```

It is non-destructive: existing files are left unchanged. Use a specific private folder, not a home directory or the public skill repository.

The advanced helper scripts are deliberately local-only:

```bash
python3 scripts/version_resume.py snapshot /private/master-resume.docx \
  --store /private/30-materials/versions --target target-role

python3 scripts/attachment_manifest.py record /private/resume.pdf \
  --manifest /private/30-materials/attachments.json \
  --target-portal example.com --employer "Example Employer" \
  --role "Example Role"
```

The first command creates a version snapshot. The second records a hash and intended upload destination; neither command uploads or submits anything.

## Automation and safety

The first-use onboarding asks separately about draft saving, safe checkbox selection, uploads, review level, and final submission. The relevant settings are stored in the user's private workspace.

The skill can assist with ordinary browser fields after mapping them to confirmed source data. Login, passwords, CAPTCHA, OTP/2FA, unclear sensitive questions, brittle selectors, and sensitive uploads require a user handoff or explicit confirmation. A saved preference never silently submits an application: final submission remains tied to the exact employer, campaign, role, portal, and current confirmation.

## Privacy

Do not commit the generated private workspace to this repository. Keep resumes, transcripts, identity documents, screenshots, attachments, contact details, and application cards outside the public skill package. The initializer adds a starter `.gitignore`, but users should review it before publishing any repository.

## Design principles

- Use official sources where possible and record retrieval dates.
- Separate job visibility, application openness, draft saving, submission, assessment, interview, and result stages.
- Use `needs-confirmation` or `unknown` instead of guessing.
- Tailor from verified evidence and preserve a master resume.
- Record what happened, what proves it, and what the next user action is.

See `references/advanced-features.md` for the implemented versioning, attachment, portal-adapter, and interview-preparation workflows. See `references/extension-roadmap.md` for the next recommended additions, including answer governance, reminders, reconciliation, privacy-safe analytics, and anonymized public-progress export.

## 通用功能与隐私边界

支持先上传简历再核对表单、解析覆盖恢复、独立起止日期核验、多岗位名额核查和逐岗位进度看板。招聘类型、岗位排序、城市、薪资及申请数量策略均由使用者在私人工作区配置。

浏览器工作流优先使用宿主提供的 Playwright 元素操作，结合键盘恢复、iframe 定位、文件选择器和必要的视觉核查。它是可移植的操作规范，不捆绑浏览器会话、Cookie、令牌或账号，也不假定每个宿主都提供相同的 Playwright API。

公开包仅包含 skill 指令、空白模板和本地辅助脚本。个人知识库、简历、成绩单、身份证件、截图、内推码和真实投递记录必须放在公开仓库之外。发布前检查待提交文件及 Git 历史；`.gitignore` 不能清除已提交的数据。

本项目衍生自 [Job Application Copilot](https://github.com/cong1005/job-application-copilot)，保留原作者 MIT 许可证。新增通用浏览器纠错、附件核验和投递追踪规范。
