import Link from "next/link";
import OpenAI from "openai";
import Script from "next/script";

const JD_PREVIEW_LENGTH = 400;
const RESUME_PREVIEW_LENGTH = 320;
const KEYWORD_LIMIT = 8;
const REWRITE_PAIR_COUNT = 3;
const EMAIL_PREVIEW_MAX_LINES = 24;

function inferLanguageFromJd(jd: string) {
  const chineseCount = (jd.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latinCount = (jd.match(/[A-Za-z]/g) ?? []).length;
  return latinCount > chineseCount ? ("en" as const) : ("zh" as const);
}

function cleanPackageText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[：:·•\-\s]+/, "")
    .replace(/[，。；;、\s]+$/, "")
    .trim();
}

function findNamedLineValue(lines: string[], patterns: RegExp[]) {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const value = match?.[1];
      if (!value) continue;

      const cleaned = cleanPackageText(value);
      if (cleaned) return cleaned;
    }
  }

  return "";
}

function inferApplicationPackage(jd: string) {
  const lines = jd
    .split(/\r?\n/)
    .map((line) => cleanPackageText(line))
    .filter(Boolean);

  const company = findNamedLineValue(lines, [
    /(?:公司|公司名称|招聘公司|企业名称|company)\s*[:：]\s*(.+)$/i,
    /^(.{2,30}?)(?:招聘|诚聘)/,
    /^(.{2,30}?)\s+(?:is hiring|hiring)\b/i,
  ]).slice(0, 30);

  const roleFromField = findNamedLineValue(lines, [
    /(?:岗位|岗位名称|职位|职位名称|job title|role|title)\s*[:：]\s*(.+)$/i,
  ]);

  const roleFromLine =
    lines.find(
      (line) =>
        /(工程师|开发|产品经理|设计师|分析师|运营|算法|数据|实习生|Engineer|Developer|Manager|Designer|Analyst|Scientist|Intern)/i.test(line) &&
        line.length <= 40,
    ) ?? "";

  const role = cleanPackageText(roleFromField || roleFromLine).slice(0, 40);

  return { company, role };
}

function buildOutreachEmail({
  language,
  keywords,
}: {
  language: "zh" | "en";
  keywords: string[];
}) {
  const hasFrontend = keywords.some((k) => k.includes("React") || k.includes("前端"));
  const hasData = keywords.some((k) => k.includes("SQL") || k.includes("数据"));
  const hasMl = keywords.some((k) => k.includes("ML") || k.includes("机器学习"));

  const focus = hasFrontend
    ? language === "zh"
      ? "前端工程化与性能优化"
      : "frontend engineering and performance"
    : hasMl
      ? language === "zh"
        ? "机器学习落地与迭代"
        : "ML productionization and iteration"
      : hasData
        ? language === "zh"
          ? "数据分析与指标建设"
          : "data analytics and metrics"
        : language === "zh"
          ? "端到端交付与协作"
          : "end-to-end delivery and collaboration";

  if (language === "en") {
    return {
      languageLabel: "英文",
      subject: "Application for the role — tailor resume",
      body: [
        "Hi Hiring Team,",
        "",
        "I’m applying for this position. I reviewed the job description and tailored my resume to highlight relevant experience, especially around " +'[focus]' + "."   
          ,
        "",
        "",
        "Thanks for your time,",
        "Your Name",
      ]
        .slice(0, EMAIL_PREVIEW_MAX_LINES)
        .join("\n"),
    };
  }

  return {
    languageLabel: "中文",
    subject: "应聘贵司岗位｜已根据 JD 定制简历",
    body: [
      "您好，招聘团队：",
      "",
      "我想应聘该岗位。我已阅读职位描述，并根据 JD 调整了简历，重点突出与 " +'[focus]' +
        " 相关的经历与成果。",
      "",
      "如有需要，我也可以进一步补充最匹配的项目说明与结果指标（可用 X%/X 天等占位描述）。",
      "",
      "谢谢您的时间，期待回复。",
      "你的名字",
    ]
      .slice(0, EMAIL_PREVIEW_MAX_LINES)
      .join("\n"),
  };
}

function extractKeywords(jd: string) {
  const text = jd.toLowerCase();

  const hasPython = text.includes("python");
  const hasSql = text.includes("sql");
  const hasMl =
    text.includes("machine learning") ||
    text.includes("机器学习") ||
    /\bml\b/.test(text);
  const hasData = text.includes("data") || text.includes("数据");
  const hasFrontend =
    text.includes("frontend") || text.includes("前端") || text.includes("react");

  const keywords: string[] = [];
  if (hasPython) keywords.push("Python");
  if (hasSql) keywords.push("SQL");
  if (hasMl) keywords.push("机器学习 / ML");
  if (hasData) keywords.push("数据");
  if (hasFrontend) keywords.push("前端 / React");

  return keywords.slice(0, KEYWORD_LIMIT);
}

function pickResumePhrases(resume: string) {
  const lines = resume
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const picked: string[] = [];
  for (const line of lines) {
    if (picked.length >= REWRITE_PAIR_COUNT) break;
    if (line.length < 8) continue;
    picked.push(line.length > 60 ? line.slice(0, 60) + "…" : line);
  }

  return picked;
}

function analyzeJd(jd: string, keywords: string[], resume: string) {
  const text = jd.toLowerCase();

  const required: string[] = [];
  const bonus: string[] = [];

  // 关键词 -> 必备要求（偏可信、可执行）
  if (keywords.includes("Python")) required.push("具备编程与脚本/数据处理能力");
  if (keywords.includes("SQL")) required.push("能够使用完成查询、指标口径与数据校验");
  if (keywords.includes("机器学习 / ML")) required.push("理解基本流程");
  if (keywords.includes("数据")) required.push("具备 数据分析意识，能用指标描述结果");
  if (keywords.includes("前端 / React")) required.push("熟悉 前端工程化与 act组件化开发");

  // JD 常见信号词 -> 必备/加分（简单 includes 规则）
  if (text.includes("协作") || text.includes("沟通") || jd.includes("沟通")) {
    required.push("能进行跨团队沟通协作与推进落地");
  }
  if (text.includes("性能") || jd.includes("性能")) {
    bonus.push("有性能优化经验（首屏/查询/训练效率等）");
  }
  if (text.includes("开源") || text.includes("github") || text.includes("竞赛") || jd.includes("论文")) {
    bonus.push("有开源/竞赛/论文等可证明的项目产出");
  }
  if (text.includes("英文") || text.includes("英语")) {
    bonus.push("英文阅读与书面沟通能力");
  }

  if (required.length === 0) {
    required.push("能清晰描述项目：你做了什么、怎么做、做出了什么结果");
    required.push("技能与岗位匹配：把最相关的经验放在简历上半部分");
  }

  if (bonus.length === 0) {
    bonus.push("有量化成果（提升/降低/缩短）与可复现的实践细节");
  }

  // 缺口提示：JD 需要但简历没有明显出现（只做最基础的字符串判断）
  const resumeText = resume.toLowerCase();
  const gaps: string[] = [];

  const gapChecks: Array<{ key: string; label: string; variants: string[] }> = [
    { key: "Python", label: "Python", variants: ["python"] },
    { key: "SQL", label: "SQL", variants: ["sql"] },
    { key: "机器学习 / ML", label: "机器学习/ML", variants: ["machine learning", "ml", "机器学习"] },
    { key: "数据", label: "数据", variants: ["data", "数据"] },
    { key: "前端 / React", label: "前端/React", variants: ["frontend", "react", "前端"] },
  ];

  for (const c of gapChecks) {
    if (!keywords.includes(c.key)) continue;
    const hit = c.variants.some((v) => resumeText.includes(v));
    if (!hit) gaps.push(`JD 提到“${c.label}”，但简历中未明显体现（建议补充或前置相关经历）`);
  }

  if (resume.trim().length === 0) {
    gaps.unshift("未提供基础简历内容，无法判断缺口（建议先粘贴简历再生成）");
  }

  if (gaps.length === 0) {
    gaps.push("目前未发现明显缺口：建议继续补充量化结果与关键细节，让匹配度更“可证明”。");
  }

  return { required, bonus, gaps };
}

function buildRewritePairs(keywords: string[], resume: string) {
  const picked = pickResumePhrases(resume);
  const isDemo = picked.length < REWRITE_PAIR_COUNT;

  const originals =
    picked.length >= REWRITE_PAIR_COUNT
      ? picked.slice(0, REWRITE_PAIR_COUNT)
      : [
        "负责项目功能开发与迭代",
        "参与数据分析与报表制作",
        "优化系统性能并修复线上问题",
      ].slice(0, REWRITE_PAIR_COUNT);

  const hasFrontend = keywords.includes("前端 / React");
  const hasData = keywords.includes("数据") || keywords.includes("SQL");
  const hasMl = keywords.includes("机器学习 / ML");

  const techHint = hasFrontend
    ? "（React/组件化/性能优化）"
    : hasMl
      ? "（训练/评估/上线监控）"
      : hasData
        ? "（SQL/指标/数据质量）"
        : "（方法/工具/协作）";

  const pairs = originals.map((o, idx) => {
    const rewritten =
      idx === 0
        ? `主导关键模块落地 ，将需求拆解为可交付里程碑，推动上线并带来可量化结果（例如转化率 +X% / 耗时 -X%）。`
        : idx === 1
          ? `基于业务目标完成分析闭环 ：明确口径→采集/清洗→验证→产出结论，沉淀可复用模板提升效率（例如报表耗时 -X%）。`
          : `建立问题定位与优化流程 ：复现→定位→方案→回归，降低线上风险并提升稳定性（例如错误率 -X% / 响应时间 -X%）。`;

    const idea =
      "把“做了什么”改成“解决什么问题 + 怎么做 + 做出什么结果”，并补上具体技术点与量化指标。";

    return { original: o, rewritten, idea };
  });

  return { isDemo, pairs };
}

function buildMockBullets(keywords: string[], hasResume: boolean) {
  const bullets: string[] = [];

  if (keywords.includes("Python")) {
    bullets.push(
      hasResume
        ? "把简历里与 Python 相关的经历改写为“解决的问题 + 关键实现 + 结果”，并补充可量化指标（效率/成本/时长）。"
        : "建议一条 Python 相关经历（脚本/自动化/数据处理），并用数字描述效果。"
    );
  }
  if (keywords.includes("SQL")) {
    bullets.push(
      hasResume
        ? "将数据相关经历改写为“解决的问题 + 关键实现 + 结果”，并补充可量化指标（效率/成本/时长）。"
        : "建议补充 SQL 能力：复杂查询与数据质量校验，并说明你如何优化查询性能。"
    );
  }
  if (keywords.includes("机器学习 / ML")) {
    bullets.push(
      hasResume
        ? "把模型相关经历写完整：数据准备→特征→训练→评估→上线监控→迭代，并点出关键指标（AUC/准确率/召回）。"
        : "建议补充机器学习流程实践：训练、评估、上线监控与迭代，并说明你关注的核心指标。"
    );
  }
  if (keywords.includes("数据")) {
    bullets.push(
      hasResume
        ? "为每个核心项目增加 1–2 个结果指标（转化/留存/效率），让“数据驱动”更可信。"
        : "建议用数据补强亮点：每条经历至少给一个结果指标（提升/降低/缩短）。"
    );
  }
  if (keywords.includes("前端 / React")) {
    bullets.push(
      hasResume
        ? "将前端项目改写为要点：React 组件化、状态管理、性能优化（首屏/拆包/缓存/渲染排查）+ 产出指标。"
        : "建议补充前端项目要点：React 组件化与性能优化，并写清你负责的关键模块。"
    );
  }

  const defaultBullets = [
    hasResume
      ? "将简历中的项目要点统一成“动作 + 方法 + 结果”，删除重复/空泛表述，把最相关的经历放在前面。"
      : "请先粘贴基础简历内容（项目/经历/技能），我们才能把“定制”写得更像真实改写。",
    "把与 JD 最相关的技能放到简历上半部分：核心技能、代表项目、亮点成果。",
    "为每个项目补充背景与目标，并用 1–2 个数字说明影响（如效率提升、成本降低、时长缩短）。",
    "增加协作与推动：需求澄清、跨团队对齐、风险预案与落地复盘，让经历更完整。",
  ];

  for (const b of defaultBullets) {
    if (bullets.length >= 4) break;
    bullets.push(b);
  }

  return bullets.slice(0, 4);
}

type ModelRewritePair = {
  original: string;
  rewritten: string;
  idea: string;
};

type ModelResult = {
  keywords: string[];
  required: string[];
  bonus: string[];
  gaps: string[];
  rewritePairs: ModelRewritePair[];
};

const REWRITE_PROTECTED_TERMS = [
  "java",
  "c++",
  "c#",
  "python",
  "javascript",
  "typescript",
  "react",
  "vue",
  "angular",
  "spring",
  "spring boot",
  "mysql",
  "postgresql",
  "postgres",
  "redis",
  "kafka",
  "docker",
  "kubernetes",
  "aws",
  "dynamodb",
  "s3",
  "volcengine",
  "postman",
  "pytorch",
  "tensorflow",
  "rllib",
  "opencv",
  "spark",
  "flink",
  "hadoop",
  "computer vision",
  "cv",
  "nlp",
  "llm",
  "backend",
  "frontend",
  "trading",
  "计算机视觉",
  "后端",
  "前端",
  "交易",
  "强化学习",
  "机器学习",
] as const;

const REWRITE_RESULT_SIGNALS = [
  "latency",
  "throughput",
  "accuracy",
  "precision",
  "recall",
  "fps",
  "qps",
  "tps",
  "gpu",
  "gpus",
  "stream",
  "streams",
  "rows",
  "records",
  "users",
  "latencies",
  "p95",
  "p99",
  "ms",
  "秒",
  "延迟",
  "吞吐",
  "准确率",
  "召回",
  "精确率",
  "流",
  "路",
  "行",
  "条",
  "成本",
  "效率",
  "错误率",
  "响应时间",
] as const;

function enforceEnglishRewrite(rewritten: string) {
  const trimmed = rewritten.trim();
  if (!trimmed) return "";
  if (/[A-Za-z]/.test(trimmed) && !/[\u4e00-\u9fff]/.test(trimmed)) return rewritten;
  return "Delivered relevant work with clear ownership, execution details, and measurable results.";
}

function collectProtectedTerms(text: string) {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  for (const term of REWRITE_PROTECTED_TERMS) {
    if (lower.includes(term.toLowerCase())) found.add(term.toLowerCase());
  }

  const productishTokens = text.match(/\b(?=\w*[A-Z])[\w.-]{2,}\b/g) ?? [];
  for (const token of productishTokens) {
    found.add(token.toLowerCase());
  }

  return [...found];
}

function hasMetricOrResultSignal(text: string) {
  if (/\d/.test(text)) return true;
  const lower = text.toLowerCase();
  return REWRITE_RESULT_SIGNALS.some((signal) => lower.includes(signal.toLowerCase()));
}

function isOverGenericRewrite(text: string) {
  return (
    /delivered relevant work|clear ownership|execution details|measurable results|worked on|responsible for|participated in/i.test(
      text
    ) || /cross-functional|business goals|end-to-end|various/i.test(text)
  );
}

function selectSafeRewrite(original: string, rewritten: string) {
  const originalText = original.trim();
  const englishRewrite = enforceEnglishRewrite(rewritten).trim();
  if (!originalText || !englishRewrite) return originalText;

  const originalTerms = collectProtectedTerms(originalText);
  const rewriteTerms = collectProtectedTerms(englishRewrite);
  const overlappingTerms = originalTerms.filter((term) => rewriteTerms.includes(term));
  const introducedTerms = rewriteTerms.filter((term) => !originalTerms.includes(term));

  let guardReason = "";
  if (introducedTerms.length > 0) {
    guardReason = "introduced_terms";
  } else if (hasMetricOrResultSignal(originalText) && !hasMetricOrResultSignal(englishRewrite)) {
    guardReason = "dropped_metrics";
  } else if (originalTerms.length > 0 && overlappingTerms.length === 0) {
    guardReason = "changed_domain";
  } else if (originalTerms.length >= 2 && overlappingTerms.length * 2 < originalTerms.length) {
    guardReason = "dropped_technical_signals";
  } else if (
    englishRewrite.length < Math.max(24, Math.floor(originalText.length * 0.7)) &&
    isOverGenericRewrite(englishRewrite)
  ) {
    guardReason = "too_generic";
  }

  if (guardReason) {
    console.log("REWRITE_GUARD_REJECTED:", guardReason, { original: originalText, rewritten: englishRewrite });
    return originalText;
  }

  return englishRewrite;
}

function normalizeModelResult(x: unknown): ModelResult | null {
  if (!x || typeof x !== "object") return null;
  const obj = x as Record<string, unknown>;

  const keywords = Array.isArray(obj.keywords) ? obj.keywords : [];
  const required = Array.isArray(obj.required) ? obj.required : [];
  const bonus = Array.isArray(obj.bonus) ? obj.bonus : [];
  const gaps = Array.isArray(obj.gaps) ? obj.gaps : [];
  const rewritePairs = Array.isArray(obj.rewritePairs) ? obj.rewritePairs : [];

  const toStringArray = (arr: unknown[]) =>
    arr.filter((v) => typeof v === "string").map((v) => String(v));

  const pairs = rewritePairs
    .filter((p) => p && typeof p === "object")
    .map((p) => p as Record<string, unknown>)
    .map((p) => ({
      original: typeof p.original === "string" ? p.original : "",
      rewritten:
        typeof p.original === "string" && typeof p.rewritten === "string"
          ? selectSafeRewrite(p.original, p.rewritten)
          : "",
      idea: typeof p.idea === "string" ? p.idea : "",
    }))
    .filter((p) => p.original && p.rewritten && p.idea);

  const result: ModelResult = {
    keywords: toStringArray(keywords as unknown[]).slice(0, 12),
    required: toStringArray(required as unknown[]).slice(0, 8),
    bonus: toStringArray(bonus as unknown[]).slice(0, 8),
    gaps: toStringArray(gaps as unknown[]).slice(0, 8),
    rewritePairs: pairs.slice(0, 6),
  };

  if (result.rewritePairs.length < 1) return null;
  return result;
}

async function getModelTailoring({
  jd,
  resume,
}: {
  jd: string;
  resume: string;
}): Promise<ModelResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("OPENAI_CALL_SKIPPED_MISSING_API_KEY");
    return null;
  }

  const client = new OpenAI({ apiKey });
  console.log("OPENAI_KEY_PREFIX:", apiKey?.slice(0, 12));
  const schema = {
    name: "tailoring_result",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["keywords", "required", "bonus", "gaps", "rewritePairs"],
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "从 JD 中识别到的关键词标签（中文为主，可含英文缩写）",
        },
        required: {
          type: "array",
          items: { type: "string" },
          description: "必备要求（3-8 条，简短明确）",
        },
        bonus: {
          type: "array",
          items: { type: "string" },
          description: "加分项（2-8 条）",
        },
        gaps: {
          type: "array",
          items: { type: "string" },
          description: "缺口提示（2-8 条）",
        },
        rewritePairs: {
          type: "array",
          minItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["original", "rewritten", "idea"],
            properties: {
              original: { type: "string", description: "原始表述（来自简历或合理抽象）" },
              rewritten: { type: "string", description: "改写后表述（更贴合 JD，结果导向）" },
              idea: { type: "string", description: "改写思路（1 句话）" },
            },
          },
          description: "至少 3 组改写对照",
        },
      },
    },
  } as const;

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "你是中文简历定制。你将基于职位描述（JD）与用户基础简历，给出结构化的建议与改写对照具体公司/数据rewritePairs 中 original 可修改原文，idea 可用中文，但 rewritten 必须始终使用英文",
        },
        {
          role: "user",
          content: `请根据以下信息输出结构化结果。\n\n[职位描述 JD]\n${jd}\n\n[基础简历]\n${resume}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schema.name,
          schema: schema.schema,
        },
      },
    });

    console.log("OPENAI_RAW_RESPONSE:", JSON.stringify(response, null, 2));

    const typedResponse = response as {
      output_parsed?: unknown;
      output?: Array<{
        content?: Array<{ parsed?: unknown; text?: string; type?: string }>;
      }>;
    };

    const outputText = typedResponse.output?.[0]?.content?.find((c) => c?.type === "output_text")?.text;
    const parsedPayload =
      typedResponse.output_parsed ??
      typedResponse.output?.[0]?.content?.find((c) => c?.parsed)?.parsed ??
      (typeof outputText === "string" ? JSON.parse(outputText) : undefined);

    console.log("OPENAI_PARSED_PAYLOAD:", JSON.stringify(parsedPayload, null, 2));

    const parsed = normalizeModelResult(parsedPayload);

    if (parsed) {
      console.log("OPENAI_CALL_OK");
    } else {
      console.log("OPENAI_CALL_RETURNED_BUT_NORMALIZE_FAILED");
    }

    return parsed;
  } catch (error) {
    console.error("OPENAI_CALL_ERROR:", error);
    console.error("OPENAI_CALL_ERROR_MESSAGE:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export default async function TailorResultPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const jdRaw = params.jd;
  const jd = typeof jdRaw === "string" ? jdRaw.trim() : "";
  const resumeRaw = params.resume;
  const resume = typeof resumeRaw === "string" ? resumeRaw.trim() : "";
  const hasResume = Boolean(resume);
  const emailLangRaw = params.emailLang;
  const emailLang = typeof emailLangRaw === "string" ? emailLangRaw : "auto";

  const jdPreview =
    jd.length > JD_PREVIEW_LENGTH
      ? jd.slice(0, JD_PREVIEW_LENGTH) + "…"
      : jd;
  const jdDisplay = jd ? jdPreview : "暂无 JD 内容";

  const resumePreview =
    resume.length > RESUME_PREVIEW_LENGTH
      ? resume.slice(0, RESUME_PREVIEW_LENGTH) + "…"
      : resume;
  const resumeDisplay = resume ? resumePreview : "暂无简历内容";

  const keywords = jd ? extractKeywords(jd) : [];
  const jdAnalysis = analyzeJd(jd, keywords, resume);
  const rewrite = buildRewritePairs(keywords, resume);
  const bullets = buildMockBullets(keywords, hasResume);

  const modelResult = jd && resume ? await getModelTailoring({ jd, resume }) : null;
  const aiMode = modelResult ? "real" : "fallback";

  const finalKeywords = modelResult?.keywords?.length ? modelResult.keywords : keywords;
  const finalRequired = modelResult?.required?.length ? modelResult.required : jdAnalysis.required;
  const finalBonus = modelResult?.bonus?.length ? modelResult.bonus : jdAnalysis.bonus;
  const finalGaps = modelResult?.gaps?.length ? modelResult.gaps : jdAnalysis.gaps;
  const finalRewritePairs =
    modelResult?.rewritePairs?.length && modelResult.rewritePairs.length >= 3
      ? { isDemo: false, pairs: modelResult.rewritePairs.slice(0, 6) }
      : rewrite;

  const inferredLang = inferLanguageFromJd(jd);
  const finalEmailLang =
    emailLang === "en" ? "en" : emailLang === "zh" ? "zh" : inferredLang;
  const email = buildOutreachEmail({
    language: finalEmailLang,
    keywords: finalKeywords,
  });
  const packageSummary = inferApplicationPackage(jd);
  const saveRecordHref = {
    pathname: "/dashboard",
    query: {
      saved: "1",
      status: "待申请",
      company: packageSummary.company,
      role: packageSummary.role,
      emailLanguage: `${email.languageLabel}${
        emailLang === "auto" ? "（自动）" : "（手动）"
      }`,
      aiMode,
      resumeReady: finalRewritePairs.pairs.length > 0 ? "1" : "0",
      emailReady: email.body ? "1" : "0",
    },
  };

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <p className="text-[10px] text-neutral-600">AI_MODE={aiMode}</p>
        <h1 className="text-3xl font-bold text-white">定制结果（预览）</h1>
        <p className="mt-3 text-sm text-neutral-400">
          下面是一份模拟的“简历定制结果”，用来先把流程跑通。
        </p>

        {/* JD 摘要 */}
        <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <h2 className="text-sm font-semibold text-white">JD 摘要</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400 whitespace-pre-wrap">
            {jdDisplay}
          </p>
        </section>

        {/* 原始简历摘录 */}
        <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <h2 className="text-sm font-semibold text-white">原始简历摘录</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400 whitespace-pre-wrap">
            {resumeDisplay}
          </p>
          {!hasResume && (
            <p className="mt-3 text-xs text-neutral-500">
              提示：未提供基础简历内容，下面的定制要点会更偏通用建议。
            </p>
          )}
        </section>

        {/* 识别到的关键词 */}
        <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <h2 className="text-sm font-semibold text-white">识别到的关键词</h2>
          {finalKeywords.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {finalKeywords.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-neutral-700 bg-neutral-950/40 px-3 py-1 text-xs text-neutral-300"
                >
                  {k}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">未识别到关键词</p>
          )}
        </section>

        {/* JD 分析 */}
        <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <h2 className="text-sm font-semibold text-white">JD 分析</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-neutral-400">必备要求</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-300">
                {finalRequired.slice(0, 5).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-400">加分项</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-300">
                {finalBonus.slice(0, 5).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-neutral-400">缺口提示</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-300">
              {finalGaps.slice(0, 5).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* 简历改写对照 */}
        <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <h2 className="text-sm font-semibold text-white">简历改写对照</h2>
          {finalRewritePairs.isDemo && (
            <p className="mt-2 text-xs text-neutral-500">
              注：简历内容不足以抽取 3 条原始表述，以下为示例对照（仍按 JD 关键词做了方向调整）。
            </p>
          )}

          <div className="mt-4 space-y-4">
            {finalRewritePairs.pairs.map((p) => (
              <div key={p.original} className="rounded-xl border border-neutral-800 bg-neutral-950/30 p-4">
                <p className="text-xs text-neutral-500">原始表述</p>
                <p className="mt-1 text-sm text-neutral-300 whitespace-pre-wrap">
                  {p.original}
                </p>

                <p className="mt-3 text-xs text-neutral-500">改写后表述</p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <p className="text-sm text-neutral-100 whitespace-pre-wrap">
                    {p.rewritten}
                  </p>
                  <button
                    type="button"
                    data-copy-text={p.rewritten}
                    className="shrink-0 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                  >
                    复制
                  </button>
                </div>

                <p className="mt-3 text-xs text-neutral-500">改写思路</p>
                <p className="mt-1 text-sm text-neutral-400">{p.idea}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 定制要点 */}
        <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <h2 className="text-sm font-semibold text-white">定制后的简历要点</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-300">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        {/* 求职邮件（示例） */}
        <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <h2 className="text-sm font-semibold text-white">求职邮件（示例）</h2>
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-neutral-400">邮件语言</p>
              <p className="mt-1 text-sm text-neutral-300">
                {email.languageLabel}
                {emailLang === "auto" ? "（自动）" : "（手动）"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-400">邮件主题</p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <p className="text-sm text-neutral-100">{email.subject}</p>
                <button
                  type="button"
                  data-copy-text={email.subject}
                  className="shrink-0 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                >
                  复制
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-400">邮件正文</p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-sm text-neutral-300">
                  {email.body}
                </p>
                <button
                  type="button"
                  data-copy-text={email.body}
                  className="shrink-0 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                >
                  复制
                </button>
              </div>
            </div>
          </div>
        </section>


        <p className="mt-6 text-xs text-neutral-500">
          {aiMode === "real"
            ? "当前结果由真实 AI 模型生成。"
            : "当前结果为 fallback 演示结果，真实 AI 调用未成功。"}
        </p>


        <div className="mt-8 flex gap-4">
          <Link
            href={saveRecordHref}
            className="inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-white/10 transition hover:bg-neutral-100 hover:shadow-white/20"
          >
            保存到投递记录
          </Link>
          <Link
            href="/dashboard"
            className="inline-block rounded-xl border border-neutral-700 px-6 py-3 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-white"
          >
            仅查看投递记录
          </Link>
        </div>
      </div>
      <Script id="tailor-copy-actions" strategy="afterInteractive">{`
        (() => {
          if (window.__tailorCopyActionsBound) return;
          window.__tailorCopyActionsBound = true;
          document.addEventListener("click", async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const button = target.closest("button[data-copy-text]");
            if (!(button instanceof HTMLButtonElement)) return;
            const text = button.dataset.copyText;
            if (!text) return;
            const originalLabel = button.dataset.copyLabel || button.textContent || "复制";
            button.dataset.copyLabel = originalLabel;
            await navigator.clipboard.writeText(text);
            button.textContent = "已复制";
            window.setTimeout(() => {
              button.textContent = button.dataset.copyLabel || "复制";
            }, 1200);
          });
        })();
      `}</Script>
    </main>
  );
}



