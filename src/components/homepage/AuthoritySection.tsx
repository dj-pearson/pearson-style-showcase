import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Users, Zap, Award, Briefcase, Code } from 'lucide-react';

const AuthoritySection = () => {
  const statistics = [
    {
      icon: TrendingUp,
      value: "$2.8M+",
      label: "Revenue Generated",
      description: "Total revenue generated for clients through AI automation and digital transformation projects"
    },
    {
      icon: Users,
      value: "10,000+",
      label: "Platform Users",
      description: "Active users across 7 SaaS platforms serving construction, real estate, fitness, and meal planning industries"
    },
    {
      icon: Zap,
      value: "40%",
      label: "Cost Reduction",
      description: "Average operational cost reduction achieved for clients through AI-powered automation solutions"
    },
    {
      icon: Award,
      value: "83%",
      label: "Retention Rate",
      description: "Client retention improvement through AI-powered CRM systems and automated customer engagement"
    }
  ];

  const expertiseAreas = [
    {
      icon: Code,
      title: "AI & Automation",
      capabilities: [
        "Custom AI workflow design and implementation",
        "Integration with OpenAI, Claude, and leading LLMs",
        "Automated business process optimization",
        "Intelligent data processing and analysis"
      ]
    },
    {
      icon: TrendingUp,
      title: "Business Intelligence",
      capabilities: [
        "Real-time analytics dashboards and reporting",
        "Predictive analytics for revenue forecasting",
        "Customer behavior analysis and segmentation",
        "Data-driven decision support systems"
      ]
    },
    {
      icon: Briefcase,
      title: "SaaS Development",
      capabilities: [
        "Full-stack web application development",
        "React, TypeScript, and modern frameworks",
        "Scalable cloud architecture (AWS, Supabase)",
        "API design and third-party integrations"
      ]
    },
    {
      icon: Zap,
      title: "Digital Transformation",
      capabilities: [
        "Legacy system modernization strategies",
        "Process digitization and workflow automation",
        "Change management and team training",
        "Technology stack optimization"
      ]
    }
  ];

  return (
    <section className="mobile-section mobile-container bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="mobile-heading-lg text-primary mb-4">
            AI-Driven Business Transformation: Data-Backed Results
          </h2>
          <p className="mobile-body text-muted-foreground max-w-3xl mx-auto">
            With over 15 years of experience in technology and business development, I've helped 50+ businesses implement
            AI solutions that deliver measurable results. Here's the impact we've achieved together.
          </p>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {statistics.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card
                key={index}
                className="group hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:border-primary/50"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold text-primary mb-2">
                    {stat.value}
                  </div>
                  <div className="font-semibold text-foreground mb-2">
                    {stat.label}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Methodology Section */}
        <div className="mb-16">
          <Card className="bg-card/50 border-border">
            <CardContent className="p-8 sm:p-10">
              <h3 className="text-2xl font-bold text-foreground mb-6 text-center">
                How I Achieve These Results
              </h3>
              <div className="grid sm:grid-cols-2 gap-6 text-muted-foreground">
                <div>
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-sm">1</span>
                    Deep Process Analysis
                  </h4>
                  <p className="text-sm leading-relaxed ml-8">
                    I start every engagement with a comprehensive audit of your current workflows, identifying bottlenecks,
                    repetitive tasks, and opportunities for automation. This data-driven approach ensures we focus on
                    high-impact areas first.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-sm">2</span>
                    Right-Fit Technology Selection
                  </h4>
                  <p className="text-sm leading-relaxed ml-8">
                    Not every business needs custom development. I evaluate your needs against available tools,
                    recommending the most cost-effective solution—whether that's configuring existing platforms or
                    building custom solutions.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-sm">3</span>
                    Phased Implementation
                  </h4>
                  <p className="text-sm leading-relaxed ml-8">
                    I implement in phases, starting with quick wins that demonstrate ROI within 30-60 days. This builds
                    momentum and confidence while minimizing disruption to your operations.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-sm">4</span>
                    Ongoing Optimization
                  </h4>
                  <p className="text-sm leading-relaxed ml-8">
                    AI systems improve with use. I provide monitoring, analytics, and continuous refinement to ensure
                    your automation delivers increasing value over time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expertise Matrix */}
        <div className="mb-12">
          <h3 className="text-2xl sm:text-3xl font-bold text-center text-foreground mb-8">
            Areas of Expertise
          </h3>
          <div className="grid sm:grid-cols-2 gap-6">
            {expertiseAreas.map((area, index) => {
              const Icon = area.icon;
              return (
                <Card
                  key={index}
                  className="hover:shadow-lg hover:border-primary/50 transition-all duration-300"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <h4 className="text-xl font-semibold text-foreground">
                        {area.title}
                      </h4>
                    </div>
                    <ul className="space-y-2">
                      {area.capabilities.map((capability, capIndex) => (
                        <li
                          key={capIndex}
                          className="text-sm text-muted-foreground flex items-start gap-2"
                        >
                          <span className="text-primary mt-1">•</span>
                          <span>{capability}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Trust Signals */}
        <div className="text-center">
          <Card className="inline-block bg-muted/30 border-border">
            <CardContent className="p-6 sm:p-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
                <div>
                  <div className="text-3xl font-bold text-primary mb-1">15+</div>
                  <div className="text-sm text-muted-foreground">Years Experience</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-1">50+</div>
                  <div className="text-sm text-muted-foreground">Clients Served</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-1">7</div>
                  <div className="text-sm text-muted-foreground">Active Platforms</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-1">20+</div>
                  <div className="text-sm text-muted-foreground">Technologies</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default AuthoritySection;
