# Sprint Insights

A single-page application for displaying and analyzing delivery iteration data with integrated LLM capabilities.

## Features

- **Team Configuration Management**: Support for JIRA and Buildkite integration configuration
- **Sprint Data Display**: Real-time fetching and display of Sprint data
- **Historical Trend Analysis**: Multi-iteration data comparison and trend charts
- **AI-Powered Analysis**: Sprint data analysis based on Claude Sonnet 4
- **Free LLM Interaction**: Natural language conversation with AI assistant
- **🆕 AI Chart Generation**: Ask the AI to create custom charts and visualizations on-demand!

## Tech Stack

### Backend
- **TypeScript** + **Express** + **AWS Lambda**
- **AWS Bedrock** (Claude Sonnet 4)
- **AWS S3** (Data storage and caching)
- **AWS API Gateway**

### Frontend
- **React** + **TypeScript**
- **Material-UI (MUI)**
- **Recharts** (Data visualization)
- **Vite** (Build tool)

### Infrastructure
- **AWS** (Production environment)
- **LocalStack** (Local development)
- **Terraform** (Infrastructure as Code)

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- AWS CLI (for deployment)
- Terraform (for infrastructure)

### Local Development

1. **Clone the project**
```bash
git clone <repository-url>
cd sprint-insights
```

2. **Install dependencies**
```bash
npm install
```

3. **Start LocalStack and deploy infrastructure**
```bash
# Setup LocalStack environment
chmod +x scripts/setup-localstack.sh
./scripts/setup-localstack.sh

# Deploy infrastructure
chmod +x scripts/deploy-local.sh
./scripts/deploy-local.sh
```

4. **Configure environment variables**
```bash
cp env.template .env.development
# Edit .env.development file with your JIRA and Buildkite configuration
```

5. **Start development servers**
```bash
npm run dev
```

Visit http://localhost:3000 to view the application.

### Deploy to AWS

1. **Configure AWS credentials**
```bash
aws configure
```

2. **Deploy infrastructure**
```bash
# Use production deployment script
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh
```

## Project Structure

```
sprint-insights/
├── api/                    # Backend API
│   ├── src/
│   │   ├── controllers/    # API controllers
│   │   ├── services/       # Business services
│   │   ├── utils/          # Utility functions
│   │   └── types/          # Type definitions
│   └── serverless.yml      # Serverless configuration
├── app/                    # Frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── types/          # Type definitions
│   └── vite.config.ts     # Vite configuration
├── terraform/              # Infrastructure code
├── scripts/                # Deployment scripts
└── docker-compose.yml      # LocalStack configuration
```

## AI Chart Generation 🎨

The AI Assistant can now generate custom charts based on your requests! Simply ask for a visualization in natural language, and the AI will:

1. Understand your data structure (sprints, issues, builds, etc.)
2. Generate a chart configuration with data transformation logic
3. Render the chart in real-time

**Examples:**
- "Show me a line chart of completed issues over the last 5 sprints"
- "Create a pie chart of issue categories"
- "Show build success rate trends across sprints"

**Supported Chart Types:**
- Line Charts (trends)
- Bar Charts (comparisons)
- Pie Charts (distributions)
- Area Charts (cumulative data)

📖 **[Read the Complete Chart Generation Guide](./CHART_GENERATION_GUIDE.md)** for detailed instructions and examples.

## API Endpoints

### Team Management
- `GET /api/teams` - Get team list
- `POST /api/teams` - Create team
- `PUT /api/teams/:teamId` - Update team
- `DELETE /api/teams/:teamId` - Delete team

### Sprint Data
- `GET /api/sprints` - Get sprint data (supports fuzzy search and index-based lookup)

### LLM Analysis
- `POST /api/llm/analyze` - Sprint data analysis (returns optional chart configuration)
- `POST /api/llm/chat` - Free conversation (returns optional chart configuration)

## Data Models

### Team Configuration
```typescript
interface TeamConfig {
  team: string;
  JIRA_EMAIL: string;
  JIRA_TOKEN: string;        // Encrypted storage
  JIRA_PROJECT: string;
  JIRA_BOARD_ID: string;
  BUILDKITE_TOKEN: string;    // Encrypted storage
  BUILDKITE_PIPELINES: string;
}
```

### Sprint Data
```typescript
interface SprintData {
  sprint: SprintMeta;
  columns: SprintColumn[];
  issues: Issue[];
  builds: Build[];
}
```

## Environment Variables

### Development Environment (.env.development)
```bash
AWS_REGION=us-east-1
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022
S3_BUCKET_NAME=sprint-insights-data
LOCALSTACK_ENDPOINT=http://localhost:4566
ENCRYPTION_KEY=your-32-character-secret-key-here!
JIRA_BASE_URL=https://your-domain.atlassian.net
BUILDKITE_ORG_SLUG=your-org-slug
FRONTEND_URL=http://localhost:3000
API_VERSION=v1
```

### Production Environment
```bash
AWS_REGION=us-east-1
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022
S3_BUCKET_NAME=your-s3-bucket
ENCRYPTION_KEY=your-32-character-secret-key
JIRA_BASE_URL=https://your-domain.atlassian.net
BUILDKITE_ORG_SLUG=your-org-slug
FRONTEND_URL=https://your-frontend-domain.com
API_VERSION=v1
```

## Development Guide

### Adding New Features

1. **Backend API**: Add new controllers and services under `api/src/`
2. **Frontend Components**: Add new React components under `app/src/components/`
3. **Type Definitions**: Update TypeScript types in the respective `types/` directories

### Testing

```bash
# Run API tests
cd api && npm test

# Run frontend tests
cd app && npm test
```

### Code Standards

- Use TypeScript strict mode
- Follow ESLint and Prettier configuration
- Write unit tests
- Use semantic commit messages

## Maintenance

### Cleaning Sprint Data Cache

Sprint data is cached in S3 to improve performance. To clear the cache:

**For Local Development:**
```bash
./scripts/clean-cache.sh local
```

**For Production:**
```bash
./scripts/clean-cache.sh production
```

The script will:
- List all cached sprint data files
- Delete them from S3
- Verify the cache is empty
- For production, it will ask for confirmation before deleting

**When to clean the cache:**
- After updating sprint data calculation logic
- When testing with fresh data
- If cached data appears stale or corrupted
- After changing team configurations

**Note:** The `API_VERSION` environment variable is automatically included in cache file names. Increment the version (e.g., from `v1` to `v2`) when making breaking changes to the data structure to invalidate old cache files without manually deleting them.

## Troubleshooting

### Common Issues

1. **LocalStack Connection Failed**
   - Ensure Docker service is running
   - Check if port 4566 is occupied

2. **API Call Failed**
   - Check environment variable configuration
   - Verify LocalStack service status

3. **LLM Analysis Failed**
   - Verify Bedrock model ID
   - Check AWS credentials configuration

## Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## License

MIT License

## Contact

For questions or suggestions, please create an Issue or contact the development team.