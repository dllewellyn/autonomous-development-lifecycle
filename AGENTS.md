I have analyzed the merged changes and updated `AGENTS.md` with the lessons learned.

# Agent Lessons Learned

This document records insights and lessons learned from analyzing merged pull requests.

---

### January 14, 2026

**Lesson:** Consistency in naming repository secrets is critical. A workflow failure was traced to a mismatch between a secret name defined in GitHub settings (`JULES_API_KEY`) and its reference in the workflow file (`JULES_API_TOKEN`). This highlights the importance of verifying configuration details, especially for secrets and environment variables, to prevent CI/CD pipeline failures. When troubleshooting authentication errors in workflows, always confirm that secret names in YAML files exactly match the names in the repository's secrets configuration.