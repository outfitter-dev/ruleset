# Agent Code Review

We use CodeRabbit for code review. It's set up to review PRs on GitHub but we also use it locally to review code.

## Instructions

1. Always ensure all formatting, linting, and checks pass.
2. Before pushing any code, run `coderabbit --prompt-only` with optional flags to customize the review:

   ```text
   # Review Types
   coderabbit --prompt-only --type uncommitted     # only uncommitted changes
   coderabbit --prompt-only --type committed       # only committed changes
   coderabbit --prompt-only --type all             # all changes

   # Base Branches
   codereview --prompt-only --base main                  # review against main
   codereview --prompt-only --base feature/branchname    # review against feature branch
   ```

3. Wait until CodeRabbit completes the review.
4. Consider and think deeply about the review's recommendations.
5. Apply the recommendations to the code, set up your commit or modified commit, then push your changes.

## Tips

- Always read the review's recommendations carefully.
- Consider adding a `sleep <seconds>` to your initial command to ensure CodeRabbit completes the review before you proceed.
- If you're working in a PR stack, consider using the branch down from your current branch as the base branch for the review.
  - If the review feedback relates to something modified further down in the stack, consider making the change in the downstream branch first.
