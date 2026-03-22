<div align="center">

<img src="./assets/d365cc-logo.png" width="60" alt="D365 Contact Center" />

*Crafted with care for contact center excellence*

</div>

# Contributing to D365 Contact Center FDE Tools

Thank you for your interest in contributing to the D365 Contact Center Forward Deployment Engineering (FDE) tools repository! We welcome contributions from the community.

## Table of Contents

- [Getting Started](#getting-started)
- [Repository Structure](#repository-structure)
- [Development Workflow](#development-workflow)
- [Adding New Tools](#adding-new-tools)
- [Code Standards](#code-standards)
- [Pull Request Process](#pull-request-process)
- [Getting Help](#getting-help)
- [Recognition](#recognition)
- [License](#license)

---

## Getting Started

### Prerequisites

- Git installed on your machine
- GitHub account
- Node.js 18+ (for JavaScript-based tools)
- Chrome or Edge browser (for extension development)

### Fork and Clone

```bash
# 1. Fork the repository on GitHub (click "Fork" button)

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/d365cc-fde.git
cd d365cc-fde

# 3. Add upstream remote to stay in sync
git remote add upstream https://github.com/microsoft/d365cc-fde.git
```

### Stay Up to Date

```bash
# Fetch latest changes from upstream
git fetch upstream

# Merge upstream changes into your main branch
git checkout main
git merge upstream/main
```

---

## Repository Structure

```
d365cc-fde/
├── README.md                 # Main repo overview
├── CONTRIBUTING.md           # This file
├── LICENSE                   # MIT License
├── CODE_OF_CONDUCT.md        # Microsoft OSS Code of Conduct
├── SECURITY.md               # Security reporting guidelines
├── SUPPORT.md                # Support information
└── tools/                    # Individual tools/solutions
    ├── dialer-helper/        # Chrome extension for country auto-fill
    │   ├── README.md         # Tool-specific docs
    │   ├── manifest.json
    │   ├── background.js
    │   ├── content/
    │   └── popup/
    └── [future-tools]/       # More tools coming soon
```

---

## Development Workflow

### Branch Strategy

| Branch | Purpose | Example |
|--------|---------|---------|
| `main` | Production-ready, stable code | - |
| `feature/*` | New features | `feature/queue-helper` |
| `fix/*` | Bug fixes | `fix/dropdown-detection` |
| `docs/*` | Documentation updates | `docs/installation-guide` |

### Standard Workflow

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull upstream main

# 2. Create a feature branch
git checkout -b feature/my-new-feature

# 3. Make your changes
# ... edit files ...

# 4. Test your changes thoroughly

# 5. Commit with clear, descriptive messages
git add .
git commit -m "feat: add automatic queue detection for transfer dialog"

# 6. Push to your fork
git push origin feature/my-new-feature

# 7. Open a Pull Request on GitHub
```

### Commit Message Format

We recommend following [Conventional Commits](https://www.conventionalcommits.org/):

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `refactor:` | Code refactoring |
| `test:` | Adding or updating tests |
| `chore:` | Maintenance tasks |

---

## Adding New Tools

### 1. Create Tool Folder

```bash
mkdir tools/my-new-tool
cd tools/my-new-tool
```

### 2. Required Files

Every tool should have:
- `README.md` - Description, installation, usage
- Source code files
- License (inherits from repo, but can add specific notices)

### 3. README Template

```markdown
# Tool Name

Brief description of what the tool does.

## Problem

What problem does this solve?

## Solution

How does this tool solve it?

## Installation

Step-by-step installation instructions.

## Usage

How to use the tool.

## Configuration

Any settings or configuration options.

## Troubleshooting

Common issues and solutions.
```

### 4. Update Main README

Add your tool to the tools list in the root README.md.

---

## Code Standards

### General

- Clear, self-documenting code
- Comments for complex logic
- Consistent formatting

### JavaScript/TypeScript

- Use `const` and `let`, not `var`
- Prefer arrow functions
- Use meaningful variable names
- Add JSDoc comments for functions

### Chrome/Edge Extensions

- Follow [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/) best practices
- Request minimal permissions (avoid broad `<all_urls>` unless necessary)
- Use `optional_permissions` for features that don't need immediate access
- Handle errors gracefully with user-friendly messages
- Use emoji prefixes in console logs for easy filtering (e.g., `📞 DIALER:`)
- Support both Chrome and Edge browsers
- Test with Developer Mode enabled

### Security & Privacy

**Before committing, ensure your code:**

- ❌ Contains no hardcoded URLs for specific organizations
- ❌ Contains no internal endpoints or API keys
- ❌ Contains no secrets, tokens, or credentials
- ❌ Contains no customer/company names in code or comments
- ✅ Uses generic, illustrative examples
- ✅ Provides configuration options for environment-specific values
- ✅ Follows the principle of least privilege for permissions

---

## Pull Request Process

### 1. Create Pull Request

- Use clear title: `Add feature: X` or `Fix: Y`
- Fill out the PR template
- Link to any related issues

### 2. PR Checklist

Before submitting, please verify:

- [ ] Code builds and runs without errors
- [ ] No sensitive or customer-specific data included
- [ ] Changes are tested in the target environment (Chrome/Edge)
- [ ] Documentation updated if needed (README, inline comments)
- [ ] Commit messages follow conventional format
- [ ] No merge conflicts with `main` branch

### 3. Review Process

1. **Automated checks** - CLA bot verifies Contributor License Agreement
2. **Code review** - At least 1 maintainer approval required
3. **Testing** - Reviewers may test your changes locally
4. **Feedback** - Address any requested changes promptly

### 4. After Merge

- Your PR will be squash-merged to keep history clean
- Your branch will be automatically deleted
- Changes will be included in the next release
- You'll be credited in release notes

---

## Getting Help

- **Questions & Discussions**: [GitHub Discussions](https://github.com/microsoft/d365cc-fde/discussions)
- **Bug Reports**: [Open an issue](https://github.com/microsoft/d365cc-fde/issues/new?template=bug_report.md)
- **Feature Requests**: [Open an issue](https://github.com/microsoft/d365cc-fde/issues/new?template=feature_request.md)
- **Security Issues**: See [SECURITY.md](./SECURITY.md) for responsible disclosure

---

## Recognition

Contributors are recognized in our release notes and in the repository. We appreciate every contribution, whether it's:

- 🐛 Bug fixes
- ✨ New features
- 📖 Documentation improvements
- 🧪 Test coverage
- 💡 Ideas and feedback

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/).
