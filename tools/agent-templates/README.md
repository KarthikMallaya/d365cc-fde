<div align="center">

<img src="../../assets/d365cc-logo.png" width="60" alt="D365 Contact Center" />

*Crafted with care for contact center excellence*

</div>

# Agent Templates

Production-tested templates for D365 Contact Center real-time voice agents.

---

## What Are These?

These are **parameterized configuration templates** for real-time voice agents (Speech-to-Speech). Each template represents a battle-tested pattern extracted from successful enterprise deployments.

**You provide the variables. We provide the proven structure.**

---

## Available Templates

| Industry | Template | Use Case |
|----------|----------|----------|
| [Retail](./retail/) | [Store Routing](./retail/store-routing/) | Multi-department store call routing |
| [Professional Services](./professional-services/) | [Appointment Management](./professional-services/appointment-management/) | Customer identification and scheduling |

---

## How Templates Work

Each template contains:

```
template-name/
├── README.md              # Documentation and customization guide
├── template.json          # Parameterized template ({{VARIABLES}})
└── variables.example.json # Example values to fill in
```

### Step 1: Choose a Template

Browse by industry or use case above.

### Step 2: Copy and Configure

```bash
# Copy the template
cp template.json my-agent.json

# Copy example variables
cp variables.example.json my-variables.json

# Edit with your values
code my-variables.json
```

### Step 3: Apply Variables

Replace `{{VARIABLE}}` placeholders with your values. You can use:

- Manual find/replace
- `envsubst` (Linux/Mac)
- Custom script (see template READMEs)

### Step 4: Validate

```bash
npx ajv validate -s _schema/realtime-agent.schema.json -d my-agent.json
```

### Step 5: Deploy

Import the configured JSON into your D365 Contact Center environment.

---

## Template Anatomy

### Persona & Objective

```json
{
  "persona": {
    "description": "You are a professional, friendly IVR assistant for {{COMPANY_NAME}}..."
  },
  "objective": "Identify customer intent and route calls..."
}
```

### Scope Guardrails

```json
{
  "scope_guardrails": {
    "allowed_topics": ["..."],
    "out_of_scope_behavior": "..."
  }
}
```

### Intent Handling

```json
{
  "intent_confidence_model": {
    "high_confidence": "...",
    "medium_confidence": "...",
    "low_confidence": "..."
  }
}
```

### Tool Integration

```json
{
  "tool_usage": {
    "{{YOUR_TOOL_NAME}}": {
      "usage": "...",
      "inputs": ["..."],
      "output_handling": ["..."]
    }
  }
}
```

---

## Schema Validation

All templates conform to the [realtime-agent.schema.json](./_schema/realtime-agent.schema.json) schema.

Validate your configured agent:

```bash
# Install ajv-cli
npm install -g ajv-cli

# Validate
ajv validate -s _schema/realtime-agent.schema.json -d your-agent.json
```

---

## Best Practices

### Do

- Test each tool independently before full agent deployment
- Start with example variables, then customize
- Validate against schema before deployment
- Monitor analytics after go-live

### Don't

- Fabricate tool responses or IDs
- Skip datetime validation rules
- Deploy without testing escalation paths
- Ignore schema validation errors

---

## Contributing Templates

Have a production-tested pattern? We'd love to include it.

1. Parameterize all customer-specific values
2. Remove any identifying information
3. Include comprehensive README
4. Add example variables
5. Submit a PR

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

---

## Questions?

- [Open a discussion](https://github.com/microsoft/d365cc-fde/discussions)
- [Report an issue](https://github.com/microsoft/d365cc-fde/issues)
