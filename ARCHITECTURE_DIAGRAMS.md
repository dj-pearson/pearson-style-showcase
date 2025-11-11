# Architecture Diagrams

This document contains visual representations of the system architecture using Mermaid diagrams. These diagrams help understand the structure, data flow, and relationships within the application.

## Table of Contents

1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Frontend Architecture](#2-frontend-architecture)
3. [Backend Architecture](#3-backend-architecture)
4. [Database Schema](#4-database-schema)
5. [Authentication Flow](#5-authentication-flow)
6. [Amazon Article Pipeline Flow](#6-amazon-article-pipeline-flow)
7. [Content Generation Flow](#7-content-generation-flow)
8. [Deployment Architecture](#8-deployment-architecture)
9. [API Integration Map](#9-api-integration-map)
10. [Data Flow Diagrams](#10-data-flow-diagrams)

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Mobile[Mobile Browser]
    end

    subgraph "CDN & Hosting"
        CF[Cloudflare Pages<br/>Static Assets]
    end

    subgraph "Frontend Application"
        React[React 18 SPA<br/>TypeScript + Vite]
        Router[React Router]
        State[TanStack Query<br/>State Management]
        UI[shadcn/ui + Tailwind]
    end

    subgraph "Backend Services"
        SB[Supabase]
        Auth[Authentication Service]
        DB[(PostgreSQL Database)]
        Edge[Edge Functions<br/>11 Serverless Functions]
    end

    subgraph "External Services"
        OpenAI[OpenAI API]
        Lovable[Lovable AI Gateway<br/>Gemini 2.5 Flash]
        SerpAPI[SerpAPI<br/>Product Discovery]
        Google[Google Custom Search]
        Resend[Resend Email Service]
        Amazon[Amazon Associates]
    end

    Browser --> CF
    Mobile --> CF
    CF --> React
    React --> Router
    React --> State
    React --> UI

    State --> SB
    React --> Auth
    React --> Edge

    Auth --> DB
    Edge --> DB

    Edge --> OpenAI
    Edge --> Lovable
    Edge --> SerpAPI
    Edge --> Google
    Edge --> Resend

    DB -.Affiliate Links.-> Amazon

    style Browser fill:#e1f5ff
    style Mobile fill:#e1f5ff
    style CF fill:#f9f871
    style React fill:#61dafb
    style SB fill:#3ecf8e
    style DB fill:#336791
    style Edge fill:#68a063
```

---

## 2. Frontend Architecture

```mermaid
graph TB
    subgraph "Pages Layer"
        Home[HomePage<br/>Hero + Latest Content]
        About[AboutPage<br/>Bio + Experience]
        Projects[ProjectsPage<br/>Portfolio Showcase]
        News[NewsPage<br/>Articles + Blog]
        AITools[AIToolsPage<br/>Tools Directory]
        Contact[ContactPage<br/>Form + Info]
        Admin[AdminDashboard<br/>15+ Management UIs]
    end

    subgraph "Component Layer"
        Layout[Layout Components<br/>Header, Footer, Nav]
        Common[Common Components<br/>50+ Reusable]
        Hero[3D Hero<br/>Three.js Animation]
        Forms[Form Components<br/>React Hook Form]
        Tables[Data Tables<br/>Sorting, Filtering]
        Charts[Charts<br/>Recharts]
    end

    subgraph "State Management"
        Query[TanStack Query<br/>Server State]
        Context[React Context<br/>Auth, Theme]
        Local[localStorage<br/>Sessions, Prefs]
    end

    subgraph "Utilities"
        Hooks[Custom Hooks<br/>5 Hooks]
        Utils[Utility Functions<br/>Validation, Format]
        Security[Security Utils<br/>DOMPurify, Validation]
    end

    subgraph "Routing"
        PublicRoutes[Public Routes]
        ProtectedRoutes[Protected Routes<br/>Admin Only]
    end

    Home --> Layout
    About --> Layout
    Projects --> Layout
    News --> Layout
    AITools --> Layout
    Contact --> Layout
    Admin --> Layout

    Layout --> Common
    Home --> Hero
    Projects --> Tables
    News --> Tables
    Contact --> Forms
    Admin --> Forms
    Admin --> Tables
    Admin --> Charts

    Common --> Query
    Forms --> Query
    Tables --> Query

    Query --> Context
    Context --> Local

    Common --> Hooks
    Forms --> Utils
    Tables --> Utils
    Forms --> Security

    PublicRoutes --> Home
    PublicRoutes --> About
    PublicRoutes --> Projects
    PublicRoutes --> News
    PublicRoutes --> AITools
    PublicRoutes --> Contact

    ProtectedRoutes --> Admin

    style Home fill:#e3f2fd
    style Admin fill:#fff3e0
    style Query fill:#ff6b6b
    style Hero fill:#9c27b0
    style Security fill:#f44336
```

---

## 3. Backend Architecture

```mermaid
graph TB
    subgraph "Edge Functions Layer"
        AdminAuth[admin-auth<br/>Login, Sessions, 2FA]
        AIContent[ai-content-generator<br/>OpenAI Integration]
        AmazonPipeline[amazon-article-pipeline<br/>Product + Article Gen]
        GenArticle[generate-ai-article<br/>News Scraping + AI]
        GenSocial[generate-social-content<br/>Social Media Posts]
        Maintenance[maintenance-runner<br/>Scheduled Tasks]
        Newsletter[newsletter-signup<br/>Email Management]
        Webhook[send-article-webhook<br/>Make.com Integration]
        Contact[send-contact-email<br/>Contact Form Handler]
        TestAPI[test-api-setup<br/>Diagnostics]
        TrackClick[track-affiliate-click<br/>Analytics]
    end

    subgraph "Database Layer"
        Content[(Content Tables<br/>articles, projects, ai_tools)]
        Admin[(Admin Tables<br/>users, sessions, activity)]
        Commerce[(Commerce Tables<br/>products, clicks, stats)]
        Support[(Support Tables<br/>tickets, responses, kb)]
        Monitor[(Monitoring Tables<br/>metrics, alerts, logs)]
    end

    subgraph "External Integrations"
        AI[AI Services<br/>OpenAI, Lovable]
        Search[Product Discovery<br/>SerpAPI, Google]
        Email[Email Service<br/>Resend]
        Webhooks[Webhooks<br/>Make.com, Zapier]
    end

    AdminAuth --> Admin
    AIContent --> AI
    AmazonPipeline --> Commerce
    AmazonPipeline --> Content
    AmazonPipeline --> Search
    AmazonPipeline --> AI
    GenArticle --> Content
    GenArticle --> AI
    GenSocial --> Content
    GenSocial --> AI
    Maintenance --> Content
    Maintenance --> Admin
    Maintenance --> Monitor
    Newsletter --> Email
    Webhook --> Webhooks
    Contact --> Email
    TrackClick --> Commerce

    style AdminAuth fill:#ff6b6b
    style AmazonPipeline fill:#4caf50
    style AI fill:#9c27b0
    style Search fill:#2196f3
    style Email fill:#ff9800
```

---

## 4. Database Schema

### 4.1 Entity Relationship Diagram

```mermaid
erDiagram
    ARTICLES ||--o{ ARTICLE_PRODUCTS : contains
    ARTICLES ||--o{ ARTICLE_CATEGORIES : categorized_by
    ARTICLES ||--o{ AMAZON_AFFILIATE_CLICKS : tracked_by
    AMAZON_PRODUCTS ||--o{ ARTICLE_PRODUCTS : featured_in
    AMAZON_PRODUCTS ||--o{ AMAZON_AFFILIATE_CLICKS : clicked
    AMAZON_PRODUCTS ||--o{ AMAZON_AFFILIATE_STATS : stats_for

    ADMIN_USERS ||--o{ ADMIN_SESSIONS : has
    ADMIN_USERS ||--o{ USER_ROLES : assigned
    ADMIN_USERS ||--o{ COMMAND_CENTER_ACTIVITY : performs

    SUPPORT_TICKETS ||--o{ SUPPORT_TICKET_ACTIVITY : has
    SUPPORT_TICKETS }o--|| ADMIN_USERS : assigned_to

    AMAZON_PIPELINE_RUNS ||--o{ AMAZON_PIPELINE_LOGS : generates

    ARTICLES {
        uuid id PK
        string title
        string slug UK
        text content
        string category
        boolean published
        timestamp created_at
        string author
        text seo_title
        text seo_description
    }

    ARTICLE_PRODUCTS {
        uuid article_id FK
        string asin FK
        text summary
        json pros
        json cons
        json specs
    }

    AMAZON_PRODUCTS {
        string asin PK
        string title
        string brand
        decimal price
        float rating
        int rating_count
        string image_url
        timestamp last_seen_at
    }

    ADMIN_USERS {
        uuid id PK
        string email UK
        string username
        string password_hash
        boolean two_factor_enabled
        timestamp last_login
    }

    ADMIN_SESSIONS {
        uuid id PK
        uuid user_id FK
        string session_token UK
        timestamp expires_at
        string ip_address
    }

    SUPPORT_TICKETS {
        uuid id PK
        string subject
        text description
        string status
        string priority
        uuid assigned_to FK
        timestamp created_at
    }
```

### 4.2 Database Tables by Category

```mermaid
graph TB
    subgraph "Content Management"
        Articles[articles<br/>Blog + News]
        Projects[projects<br/>Portfolio]
        AITools[ai_tools<br/>Tool Directory]
        Categories[article_categories<br/>Taxonomy]
    end

    subgraph "Commerce & Affiliate"
        Products[amazon_products<br/>Product Cache]
        ArticleProducts[article_products<br/>Junction Table]
        Clicks[amazon_affiliate_clicks<br/>Click Tracking]
        Stats[amazon_affiliate_stats<br/>Daily Aggregates]
        SearchTerms[amazon_search_terms<br/>Search Management]
    end

    subgraph "Administration"
        AdminUsers[admin_users<br/>Admin Accounts]
        Sessions[admin_sessions<br/>Active Sessions]
        Roles[user_roles<br/>Permissions]
        Activity[command_center_activity<br/>Audit Log]
        PasswordReset[password_reset_tokens<br/>Reset Tokens]
    end

    subgraph "Communication"
        Newsletter[newsletter_subscribers<br/>Email List]
        EmailLogs[email_logs<br/>Send History]
        SMTPSettings[smtp_settings<br/>Email Config]
    end

    subgraph "Social Proof"
        Testimonials[testimonials<br/>Reviews]
        Profile[profile_settings<br/>Bio + Links]
        Ventures[ventures<br/>Companies]
    end

    subgraph "Support System"
        Tickets[support_tickets<br/>Help Requests]
        Responses[support_ticket_activity<br/>Conversations]
        KB[knowledge_base_articles<br/>Help Docs]
        Canned[canned_responses<br/>Templates]
    end

    subgraph "Monitoring"
        Metrics[system_metrics<br/>Performance]
        Alerts[system_alerts<br/>Notifications]
        Maintenance[maintenance_schedules<br/>Tasks]
        LinkHealth[link_health<br/>URL Monitoring]
        Performance[performance_history<br/>Historical Data]
    end

    subgraph "Pipeline Management"
        Runs[amazon_pipeline_runs<br/>Execution Tracking]
        Logs[amazon_pipeline_logs<br/>Detailed Logs]
        Settings[amazon_pipeline_settings<br/>Configuration]
    end

    Articles --> ArticleProducts
    Products --> ArticleProducts
    Articles --> Clicks
    Products --> Clicks
    Products --> Stats

    AdminUsers --> Sessions
    AdminUsers --> Roles
    AdminUsers --> Activity

    Tickets --> Responses

    Runs --> Logs

    style Articles fill:#bbdefb
    style Products fill:#c8e6c9
    style AdminUsers fill:#ffccbc
    style Newsletter fill:#f8bbd0
    style Tickets fill:#fff9c4
    style Metrics fill:#d1c4e9
    style Runs fill:#b2dfdb
```

---

## 5. Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant AdminAuth as admin-auth<br/>Edge Function
    participant Database as PostgreSQL
    participant SupabaseAuth as Supabase Auth

    User->>Browser: Enter credentials
    Browser->>AdminAuth: POST /admin-auth<br/>{email, password}

    AdminAuth->>AdminAuth: Check rate limit<br/>(5 attempts/15 min)

    alt Rate limit exceeded
        AdminAuth-->>Browser: 429 Too Many Requests
        Browser-->>User: Show error
    else Rate limit OK
        AdminAuth->>AdminAuth: Verify email whitelist<br/>(2 allowed emails)

        alt Not in whitelist
            AdminAuth-->>Browser: 403 Forbidden
            Browser-->>User: Access denied
        else In whitelist
            AdminAuth->>SupabaseAuth: signInWithPassword()

            alt Invalid credentials
                SupabaseAuth-->>AdminAuth: Authentication failed
                AdminAuth->>AdminAuth: Increment failed attempts
                AdminAuth-->>Browser: 401 Unauthorized
                Browser-->>User: Invalid credentials
            else Valid credentials
                SupabaseAuth-->>AdminAuth: User + JWT token
                AdminAuth->>Database: Check user_roles table

                alt No admin role
                    AdminAuth-->>Browser: 403 No admin role
                    Browser-->>User: Access denied
                else Has admin role
                    AdminAuth->>Database: Create admin_session
                    AdminAuth->>AdminAuth: Clear failed attempts
                    AdminAuth-->>Browser: 200 + User data
                    Browser->>Browser: Store JWT in localStorage
                    Browser-->>User: Redirect to dashboard
                end
            end
        end
    end

    Note over Browser,Database: Subsequent Requests

    User->>Browser: Access protected route
    Browser->>AdminAuth: POST /admin-auth<br/>{action: "me"}<br/>Authorization: Bearer <JWT>
    AdminAuth->>SupabaseAuth: Verify JWT token

    alt Invalid or expired token
        SupabaseAuth-->>AdminAuth: Invalid token
        AdminAuth-->>Browser: 401 Unauthorized
        Browser->>Browser: Clear localStorage
        Browser-->>User: Redirect to login
    else Valid token
        SupabaseAuth-->>AdminAuth: User data
        AdminAuth->>Database: Verify admin_session exists
        AdminAuth-->>Browser: 200 + User data
        Browser-->>User: Show protected content
    end
```

---

## 6. Amazon Article Pipeline Flow

```mermaid
flowchart TD
    Start([Pipeline Triggered]) --> CheckBusy{Pipeline<br/>running?}

    CheckBusy -->|Yes| Busy[Return 429<br/>Pipeline Busy]
    CheckBusy -->|No| CreateRun[Create pipeline_run<br/>Status: running]

    CreateRun --> GetSettings[Fetch pipeline_settings<br/>from database]
    GetSettings --> SelectTerm[Select random<br/>unused search_term]

    SelectTerm --> DiscoverProducts[Product Discovery]

    subgraph "Product Discovery with Retries"
        DiscoverProducts --> TrySerpAPI{Try SerpAPI}
        TrySerpAPI -->|Success| ProcessProducts
        TrySerpAPI -->|Fail| TryGoogle{Try Google<br/>Custom Search}
        TryGoogle -->|Success| ProcessProducts
        TryGoogle -->|Fail| RetryCount{Retry < 5?}
        RetryCount -->|Yes| SelectTerm
        RetryCount -->|No| NoProducts[Log: No products<br/>Update run: failed]
    end

    ProcessProducts[Process Products] --> ExtractASIN[Extract ASINs<br/>from URLs]
    ExtractASIN --> FilterProducts{Apply Filters}

    FilterProducts -->|Price, Rating,<br/>Review Count| ValidProducts[Valid Products]
    ValidProducts --> CacheProducts[Cache in<br/>amazon_products table]

    CacheProducts --> EnrichData[Enrich Product Data<br/>bullet points, specs]
    EnrichData --> GenerateArticle[AI Article Generation<br/>Lovable AI + Gemini 2.5]

    GenerateArticle --> ParseJSON{Parse AI<br/>Response}
    ParseJSON -->|Fail| RetryAI{Retry < 3?}
    RetryAI -->|Yes| GenerateArticle
    RetryAI -->|No| AIFailed[Log: AI generation failed<br/>Update run: failed]

    ParseJSON -->|Success| SaveArticle[Save to articles table]
    SaveArticle --> LinkProducts[Create article_products<br/>relationships]

    LinkProducts --> CreateAffiliate[Generate affiliate URLs<br/>with Amazon tag]
    CreateAffiliate --> UpdateContent[Update article content<br/>with affiliate links]

    UpdateContent --> GenerateSocial[Generate Social Content<br/>Twitter/Facebook posts]
    GenerateSocial --> SendWebhook[Send to Make.com<br/>webhook]

    SendWebhook --> UpdateRun[Update pipeline_run<br/>Status: completed]
    UpdateRun --> Success([Return Success<br/>Article + Stats])

    Busy --> End([End])
    NoProducts --> End
    AIFailed --> End
    Success --> End

    style Start fill:#4caf50
    style Success fill:#4caf50
    style Busy fill:#ff9800
    style NoProducts fill:#f44336
    style AIFailed fill:#f44336
    style GenerateArticle fill:#9c27b0
    style DiscoverProducts fill:#2196f3
    style CacheProducts fill:#00bcd4
```

---

## 7. Content Generation Flow

```mermaid
sequenceDiagram
    participant Admin as Admin User
    participant UI as Admin Dashboard
    participant EdgeFunc as Edge Function
    participant AI as Lovable AI<br/>Gemini 2.5
    participant DB as PostgreSQL
    participant Webhook as Make.com

    rect rgb(230, 240, 255)
        Note over Admin,UI: AI Article Generation
        Admin->>UI: Click "Generate AI Article"
        UI->>EdgeFunc: POST /generate-ai-article
        EdgeFunc->>EdgeFunc: Fetch articles from<br/>AI news website
        EdgeFunc->>EdgeFunc: Parse HTML<br/>Extract titles & links
        EdgeFunc->>AI: Send prompt with<br/>article context
        AI-->>EdgeFunc: Generated article JSON<br/>(title, content, SEO, tags)
        EdgeFunc->>DB: Insert into articles table
        DB-->>EdgeFunc: Article ID
        EdgeFunc->>EdgeFunc: Invoke send-article-webhook
        EdgeFunc-->>UI: Success + Article data
        UI-->>Admin: Show new article
    end

    rect rgb(240, 255, 240)
        Note over Admin,Webhook: Social Content Generation
        Admin->>UI: Click "Generate Social"<br/>for article
        UI->>EdgeFunc: POST /generate-social-content<br/>{articleId}
        EdgeFunc->>DB: Fetch article details
        DB-->>EdgeFunc: Article data
        EdgeFunc->>AI: Generate short form<br/>(Twitter/X)
        AI-->>EdgeFunc: Short form post
        EdgeFunc->>AI: Generate long form<br/>(Facebook)
        AI-->>EdgeFunc: Long form post
        EdgeFunc->>DB: Update article<br/>social_short_form, social_long_form
        EdgeFunc-->>UI: Success + Social content
        UI-->>Admin: Display generated posts
    end

    rect rgb(255, 245, 230)
        Note over EdgeFunc,Webhook: Article Distribution
        EdgeFunc->>EdgeFunc: Invoke send-article-webhook
        EdgeFunc->>DB: Fetch webhook_settings
        DB-->>EdgeFunc: Webhook URL + enabled status
        EdgeFunc->>Webhook: POST webhook_url<br/>{title, url, social, image}
        Webhook-->>EdgeFunc: 200 OK
        Webhook->>Webhook: Trigger automation<br/>(post to social media)
    end
```

---

## 8. Deployment Architecture

```mermaid
graph TB
    subgraph "Development Environment"
        Dev[Developer Workstation]
        Git[Git Repository<br/>GitHub]
    end

    subgraph "Build & CI/CD"
        Actions[GitHub Actions<br/>(optional)]
        Build[Build Process<br/>npm run build]
        Test[Test Suite<br/>Vitest]
    end

    subgraph "Cloudflare Platform"
        Pages[Cloudflare Pages]
        CDN[Cloudflare CDN<br/>Global Edge Network]
        DNS[Cloudflare DNS<br/>danpearson.net]
        Workers[Cloudflare Workers<br/>(optional)]
    end

    subgraph "Supabase Platform"
        SBProject[Supabase Project<br/>qazhdcqvjppbbjxzvisp]
        SBDB[(PostgreSQL 15<br/>Database)]
        SBAuth[Authentication]
        SBEdge[Edge Functions<br/>11 Deno Functions]
        SBStorage[Storage<br/>(optional)]
    end

    subgraph "External Services"
        OpenAI[OpenAI API]
        Lovable[Lovable AI]
        SerpAPI[SerpAPI]
        Google[Google Search API]
        Resend[Resend Email]
        Make[Make.com]
    end

    subgraph "Monitoring & Analytics"
        GA[Google Analytics]
        Sentry[Sentry<br/>(Error Tracking)]
        Logs[Supabase Logs]
    end

    Dev -->|git push| Git
    Git -->|trigger| Actions
    Actions --> Test
    Test -->|success| Build
    Build -->|deploy| Pages

    Pages --> CDN
    DNS --> CDN
    CDN -->|serve static| Pages

    Dev -->|supabase deploy| SBProject
    SBProject --> SBDB
    SBProject --> SBAuth
    SBProject --> SBEdge

    Pages -->|API calls| SBEdge
    Pages -->|auth| SBAuth

    SBEdge --> SBDB
    SBEdge --> OpenAI
    SBEdge --> Lovable
    SBEdge --> SerpAPI
    SBEdge --> Google
    SBEdge --> Resend
    SBEdge --> Make

    Pages --> GA
    Pages -.errors.-> Sentry
    SBEdge --> Logs

    style Dev fill:#e3f2fd
    style Pages fill:#f9f871
    style CDN fill:#f9f871
    style SBProject fill:#3ecf8e
    style SBDB fill:#336791
    style Build fill:#4caf50
```

---

## 9. API Integration Map

```mermaid
graph LR
    subgraph "Edge Functions"
        AdminAuth[admin-auth]
        AIGen[ai-content-generator]
        Amazon[amazon-article-pipeline]
        GenArticle[generate-ai-article]
        GenSocial[generate-social-content]
        TestAPI[test-api-setup]
    end

    subgraph "AI Services"
        OpenAI[OpenAI API<br/>GPT-4o-mini]
        Lovable[Lovable AI Gateway<br/>Gemini 2.5 Flash]
    end

    subgraph "Search & Discovery"
        Serp[SerpAPI<br/>Google Shopping]
        Google[Google Custom Search]
        DataSEO[DataForSEO<br/>Optional]
    end

    subgraph "Communication"
        Resend[Resend Email API]
        Webhooks[Webhooks<br/>Make.com/Zapier]
    end

    subgraph "E-commerce"
        AmazonAssoc[Amazon Associates<br/>Affiliate Program]
    end

    AIGen -->|Generate content| OpenAI
    GenArticle -->|Generate articles| Lovable
    GenSocial -->|Generate posts| Lovable
    Amazon -->|Generate content| Lovable
    Amazon -->|Search products| Serp
    Amazon -->|Fallback search| Google
    TestAPI -.test.-> DataSEO

    Newsletter[newsletter-signup] -->|Send emails| Resend
    Contact[send-contact-email] -->|Send emails| Resend

    Webhook[send-article-webhook] -->|Trigger automation| Webhooks

    Amazon -.affiliate links.-> AmazonAssoc

    style OpenAI fill:#74aa9c
    style Lovable fill:#9c27b0
    style Serp fill:#4285f4
    style Resend fill:#ff6b6b
    style AmazonAssoc fill:#ff9900
```

---

## 10. Data Flow Diagrams

### 10.1 User Journey - Public User

```mermaid
flowchart LR
    User([Public User]) --> Landing[Homepage<br/>3D Hero]

    Landing --> About[About Page<br/>Bio + Experience]
    Landing --> Projects[Projects<br/>Portfolio]
    Landing --> News[News/Blog<br/>Articles]
    Landing --> AITools[AI Tools<br/>Directory]
    Landing --> Contact[Contact Form]

    News --> ReadArticle[Read Article]
    ReadArticle --> ClickProduct{Click Product<br/>Link?}

    ClickProduct -->|Yes| TrackClick[Track Click<br/>affiliate-click function]
    TrackClick --> Amazon[Amazon.com<br/>Affiliate Link]

    ClickProduct -->|No| Share{Share<br/>Article?}
    Share -->|Yes| Social[Share on<br/>Social Media]

    Contact --> Submit[Submit Form]
    Submit --> SendEmail[send-contact-email<br/>function]
    SendEmail --> Resend[Resend API]
    Resend --> Owner[Site Owner Email]
    Resend --> Confirmation[User Confirmation]

    News --> Subscribe{Subscribe to<br/>Newsletter?}
    Subscribe -->|Yes| NewsletterForm[Newsletter Form]
    NewsletterForm --> SignupFunc[newsletter-signup<br/>function]
    SignupFunc --> WelcomeEmail[Welcome Email]

    style User fill:#4fc3f7
    style Amazon fill:#ff9900
    style TrackClick fill:#ffa726
    style SendEmail fill:#ff6b6b
    style SignupFunc fill:#66bb6a
```

### 10.2 User Journey - Admin User

```mermaid
flowchart TD
    Admin([Admin User]) --> Login[Login Page]

    Login --> AuthFunc[admin-auth<br/>function]
    AuthFunc --> Verify{Verify<br/>Credentials}

    Verify -->|Success| Dashboard[Admin Dashboard<br/>Command Center]
    Verify -->|Fail| Login

    Dashboard --> ManageArticles[Manage Articles]
    Dashboard --> ManageProjects[Manage Projects]
    Dashboard --> ManageAITools[Manage AI Tools]
    Dashboard --> Pipeline[Amazon Pipeline]
    Dashboard --> Analytics[Analytics]
    Dashboard --> Support[Support Tickets]

    ManageArticles --> GenerateAI{Generate<br/>with AI?}
    GenerateAI -->|Yes| AIGenFunc[generate-ai-article<br/>function]
    AIGenFunc --> LovableAI[Lovable AI]
    LovableAI --> NewArticle[New Article Created]

    GenerateAI -->|No| Manual[Manual Creation]
    Manual --> NewArticle

    NewArticle --> GenerateSocial{Generate<br/>Social?}
    GenerateSocial -->|Yes| SocialFunc[generate-social-content<br/>function]
    SocialFunc --> SocialPosts[Social Posts Created]

    SocialPosts --> SendWebhook[send-article-webhook<br/>function]
    SendWebhook --> Automation[Make.com<br/>Automation]
    Automation --> Twitter[Post to Twitter]
    Automation --> Facebook[Post to Facebook]

    Pipeline --> RunPipeline[Run Amazon Pipeline]
    RunPipeline --> PipelineFunc[amazon-article-pipeline<br/>function]
    PipelineFunc --> SearchProducts[Search Products<br/>SerpAPI/Google]
    SearchProducts --> AIArticle[AI Generated Article]
    AIArticle --> Published[Published with<br/>Affiliate Links]

    style Admin fill:#ff6b6b
    style Dashboard fill:#fff3e0
    style AIGenFunc fill:#9c27b0
    style LovableAI fill:#9c27b0
    style PipelineFunc fill:#4caf50
    style Automation fill:#00bcd4
```

### 10.3 Newsletter Signup Flow

```mermaid
sequenceDiagram
    participant User
    participant Form as Newsletter Form
    participant EdgeFunc as newsletter-signup
    participant RateLimit as Rate Limiter
    participant Validator as Email Validator
    participant DB as PostgreSQL
    participant Resend as Resend API

    User->>Form: Enter email
    Form->>EdgeFunc: POST /newsletter-signup<br/>{email}

    EdgeFunc->>RateLimit: Check IP rate limit

    alt Rate limit exceeded
        RateLimit-->>EdgeFunc: Limit exceeded
        EdgeFunc-->>Form: 429 Too Many Requests
        Form-->>User: Error message
    else Rate limit OK
        EdgeFunc->>Validator: Validate email format
        Validator->>Validator: Check disposable domains

        alt Invalid or disposable
            Validator-->>EdgeFunc: Invalid
            EdgeFunc-->>Form: 400 Bad Request
            Form-->>User: Invalid email error
        else Valid email
            EdgeFunc->>DB: Check if exists

            alt Already subscribed & active
                DB-->>EdgeFunc: Exists, active
                EdgeFunc-->>Form: 200 Already subscribed
                Form-->>User: Already subscribed message
            else New or inactive
                EdgeFunc->>DB: Insert/Update subscriber<br/>active=true
                EdgeFunc->>Resend: Send welcome email
                Resend-->>EdgeFunc: Email sent
                EdgeFunc->>DB: Update welcome_email_sent=true
                EdgeFunc-->>Form: 200 Success
                Form-->>User: Success message
                Resend-->>User: Welcome email
            end
        end
    end
```

### 10.4 Affiliate Click Tracking Flow

```mermaid
flowchart TD
    User([User]) --> Article[Reading Article]
    Article --> ProductSection[Product Recommendations<br/>Section]

    ProductSection --> ClickLink{Click<br/>Affiliate Link?}
    ClickLink -->|No| Continue[Continue Reading]

    ClickLink -->|Yes| TrackClick[JavaScript:<br/>Track Click Event]
    TrackClick --> SendData[Send to<br/>track-affiliate-click]

    SendData --> EdgeFunc[Edge Function<br/>Receives Data]
    EdgeFunc --> ParseData[Extract:<br/>articleId, asin, IP,<br/>user-agent, referrer]

    ParseData --> RecordClick[Insert into<br/>amazon_affiliate_clicks]
    RecordClick --> UpdateStats{Stats<br/>exist for<br/>today?}

    UpdateStats -->|Yes| Increment[Increment clicks count<br/>for article+asin+date]
    UpdateStats -->|No| CreateStats[Create new stats record<br/>clicks = 1]

    Increment --> Return[Return success]
    CreateStats --> Return

    Return --> RedirectUser[Redirect to Amazon]
    RedirectUser --> AmazonPage[Amazon Product Page<br/>with affiliate tag]

    AmazonPage --> Purchase{User<br/>purchases?}
    Purchase -->|Yes| Commission[Amazon tracks<br/>commission]
    Purchase -->|No| NoCommission[No commission]

    style TrackClick fill:#ffa726
    style RecordClick fill:#66bb6a
    style Commission fill:#4caf50
    style AmazonPage fill:#ff9900
```

---

## Architecture Notes

### Key Design Principles

1. **Serverless Architecture**
   - No server management required
   - Auto-scaling edge functions
   - Pay-per-execution model
   - Global distribution via Cloudflare

2. **Security-First Design**
   - Row Level Security on all tables
   - JWT authentication with short expiry
   - Input validation and sanitization
   - Rate limiting on sensitive endpoints
   - Content Security Policy headers

3. **Performance Optimization**
   - Code splitting with lazy loading
   - Vendor chunking for large libraries
   - Static asset caching (1-year)
   - TanStack Query for intelligent caching
   - Optimized bundle sizes

4. **Scalability**
   - Stateless edge functions
   - Database connection pooling
   - CDN for static assets
   - Async processing for heavy tasks

5. **Maintainability**
   - TypeScript for type safety
   - Component-based architecture
   - Reusable utility functions
   - Comprehensive error handling
   - Detailed logging

### Technology Decisions

| Aspect | Technology | Rationale |
|--------|------------|-----------|
| Frontend Framework | React 18 | Mature ecosystem, excellent performance |
| Type Safety | TypeScript | Catch errors at compile time |
| Build Tool | Vite | Fast dev server, optimized builds |
| Styling | Tailwind CSS | Utility-first, consistent design |
| UI Components | shadcn/ui | Accessible, customizable |
| State Management | TanStack Query | Server state caching, automatic updates |
| Backend | Supabase | PostgreSQL + Auth + Edge Functions |
| Hosting | Cloudflare Pages | Global CDN, automatic HTTPS |
| AI Services | OpenAI + Lovable | Best-in-class models, cost-effective |
| Email | Resend | Developer-friendly, reliable |

### Future Architecture Considerations

1. **Caching Layer**
   - Redis for session storage
   - CloudFlare Workers KV for edge caching
   - CDN cache optimization

2. **Real-time Features**
   - Supabase Realtime for live updates
   - WebSocket connections for admin dashboard
   - Live support chat

3. **Advanced Analytics**
   - Custom analytics dashboard
   - User behavior tracking
   - A/B testing infrastructure
   - Conversion funnel analysis

4. **Content Delivery**
   - Image optimization service (Cloudinary, imgix)
   - Video hosting integration
   - Multi-CDN strategy

5. **Internationalization**
   - Multi-language support
   - Locale-based content
   - Currency conversion for affiliate links

6. **Mobile App**
   - React Native app
   - Shared API endpoints
   - Push notifications

---

## Diagram Rendering

These diagrams use Mermaid syntax and can be rendered in:

- **GitHub/GitLab**: Native rendering
- **VS Code**: Mermaid Preview extension
- **Online**: mermaid.live
- **Documentation Tools**: GitBook, Docusaurus, MkDocs

To view diagrams locally:
```bash
# Install Mermaid CLI
npm install -g @mermaid-js/mermaid-cli

# Render to PNG
mmdc -i ARCHITECTURE_DIAGRAMS.md -o diagrams.png
```

---

## Related Documentation

- [Living Technical Specification](./LIVING_TECHNICAL_SPECIFICATION.md) - Complete system documentation
- [API Reference](./API_REFERENCE.md) - Detailed API endpoint documentation
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Deployment procedures and configuration
- [Deployment Summary](./DEPLOYMENT_SUMMARY.md) - Quick reference deployment guide

---

**Last Updated**: November 11, 2025
**Version**: 1.0
**Maintained By**: Development Team
