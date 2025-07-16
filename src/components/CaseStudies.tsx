import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowRight, Code, Zap, TrendingUp } from 'lucide-react';

interface CaseStudy {
  id: string;
  title: string;
  category: string;
  description: string;
  challenge: string;
  solution: string;
  results: string[];
  technologies: string[];
  icon: React.ComponentType<any>;
  gradient: string;
  link?: string;
}

const caseStudies: CaseStudy[] = [
  {
    id: 'nft-collection',
    title: 'Generative NFT Collection',
    category: 'Blockchain Development',
    description: 'Developed a unique 10,000-piece generative NFT collection with mathematical precision and artistic flair.',
    challenge: 'Create a scalable system for generating unique, mathematically-driven NFT artwork with rarity distribution.',
    solution: 'Built custom algorithms using Python and JavaScript to generate unique combinations with weighted rarity traits.',
    results: [
      '10,000 unique NFTs generated',
      '100% trait uniqueness guaranteed',
      'Optimal rarity distribution achieved',
      'Reduced generation time by 80%'
    ],
    technologies: ['Python', 'JavaScript', 'Blockchain', 'IPFS', 'Smart Contracts'],
    icon: Code,
    gradient: 'from-purple-500 to-violet-600'
  },
  {
    id: 'ai-automation',
    title: 'AI-Powered Business Automation',
    category: 'AI Integration',
    description: 'Implemented AI solutions to automate key business processes, reducing manual work by 60%.',
    challenge: 'Streamline repetitive business tasks while maintaining quality and accuracy standards.',
    solution: 'Integrated OpenAI APIs with custom workflows to automate data processing, content generation, and analysis.',
    results: [
      '60% reduction in manual tasks',
      '95% accuracy in automated processes',
      '$50k+ annual cost savings',
      '3x faster processing times'
    ],
    technologies: ['OpenAI API', 'Python', 'React', 'Node.js', 'MongoDB'],
    icon: Zap,
    gradient: 'from-cyan-500 to-blue-600'
  },
  {
    id: 'sales-growth',
    title: 'Sales Team Performance Optimization',
    category: 'Business Development',
    description: 'Led strategic initiatives that resulted in 40% revenue growth through team optimization and process improvement.',
    challenge: 'Improve sales team performance and increase revenue while maintaining customer satisfaction.',
    solution: 'Implemented data-driven sales strategies, CRM optimization, and comprehensive training programs.',
    results: [
      '40% revenue growth achieved',
      '25% increase in conversion rates',
      '90% team satisfaction score',
      'Reduced sales cycle by 30%'
    ],
    technologies: ['CRM Systems', 'Data Analytics', 'Sales Automation', 'Training Programs'],
    icon: TrendingUp,
    gradient: 'from-green-500 to-emerald-600'
  }
];

const CaseStudies = () => {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-primary">
            Case Studies
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            Real projects, real results. Here's how I've helped clients achieve their goals with innovative solutions.
          </p>
        </div>

        {/* Case Studies Grid */}
        <div className="space-y-8 sm:space-y-12">
          {caseStudies.map((study, index) => {
            const IconComponent = study.icon;
            return (
              <Card 
                key={study.id}
                className={`group hover:shadow-2xl transition-all duration-500 bg-card/50 border-border overflow-hidden ${
                  index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
                }`}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    {/* Visual/Icon Section */}
                    <div className={`lg:w-1/3 p-8 sm:p-12 bg-gradient-to-br ${study.gradient} flex items-center justify-center relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-black/10"></div>
                      <div className="relative text-center text-white">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                          <IconComponent className="w-10 h-10" />
                        </div>
                        <h4 className="text-lg font-semibold">{study.category}</h4>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="lg:w-2/3 p-6 sm:p-8">
                      <div className="mb-6">
                        <h3 className="text-2xl sm:text-3xl font-bold mb-3 text-foreground">
                          {study.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {study.description}
                        </p>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div>
                          <h4 className="font-semibold text-foreground mb-2">Challenge</h4>
                          <p className="text-sm text-muted-foreground">{study.challenge}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground mb-2">Solution</h4>
                          <p className="text-sm text-muted-foreground">{study.solution}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                        <div>
                          <h4 className="font-semibold text-foreground mb-3">Key Results</h4>
                          <ul className="space-y-2">
                            {study.results.map((result, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground flex items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2 flex-shrink-0"></div>
                                {result}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground mb-3">Technologies</h4>
                          <div className="flex flex-wrap gap-2">
                            {study.technologies.map((tech, idx) => (
                              <span 
                                key={idx}
                                className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {study.link && (
                        <Button variant="outline" className="group">
                          View Project
                          <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Call to Action */}
        <div className="text-center mt-12 sm:mt-16">
          <Button 
            size="lg"
            onClick={() => window.location.href = '/connect'}
            className="btn-futuristic"
          >
            Discuss Your Project
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CaseStudies;