Goal:
Find relevant open roles for the target companies in openclaw-workspace/data/target_companies.csv.

Hard rules:
- Do not use LinkedIn automation or scrape logged-in pages.
- Prefer company websites and ATS pages such as Greenhouse, Lever, Ashby, Workday, or direct careers pages.
- Focus on early-career or new-grad-friendly roles when possible.
- Skip clearly senior-only roles unless they explicitly mention new grad, early career, or 0-2 years experience.

Target role types:
- AI Engineer
- Applied AI Engineer
- LLM Engineer
- AI Product Engineer
- Software Engineer, AI/Infra
- ML Engineer
- Data Scientist with strong LLM or product focus
- Forward-deployed / solutions roles only if they are strongly technical

Use candidate context:
- CS + Psychology student at WashU
- graduating May 2026
- projects include Dragon Egg, FinResearch, AI Crypto-Trading Bot

For each matching role, extract:
- company
- role_title
- location
- role_url
- short_summary
- required_keywords
- preferred_keywords
- hiring_team_if_visible

Output:
Append all matching roles into openclaw-workspace/data/jobs_raw.csv

Quality bar:
- Be selective.
- Prefer roles that have a plausible fit for the candidate.
- Avoid duplicates.