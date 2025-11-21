import { useQuery } from '@tanstack/react-query';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { supabase } from '../integrations/supabase/client';
import {
  Briefcase,
  GraduationCap,
  MapPin,
  TrendingUp,
  Users,
  Award,
  ExternalLink,
  Linkedin,
  Github
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const About = () => {
  const { data: profile } = useQuery({
    queryKey: ['profile-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });

  const achievements = [
    { icon: TrendingUp, label: 'Increased client retention by 30%', company: 'Pearson Media' },
    { icon: TrendingUp, label: 'Boosted revenue by 25%', company: 'Pearson Media & Fitness World' },
    { icon: TrendingUp, label: 'Secured 15% growth in annual sales', company: 'Multiple Organizations' },
    { icon: TrendingUp, label: 'Exceeded sales quotas by 20% in 6 months', company: 'USA TODAY' },
    { icon: Users, label: '90% customer retention rate', company: 'USA TODAY' },
    { icon: TrendingUp, label: 'Drove over $600K in monthly sales across 29 locations', company: 'XSport Fitness' },
    { icon: Users, label: 'Doubled membership base', company: 'Fitness World' },
    { icon: Users, label: 'Expanded team from 5 to 15 personal trainers', company: 'Bally Total Fitness' },
  ];

  const experience = [
    {
      company: 'Pearson Media LLC',
      role: 'Founder & Developer',
      duration: 'March 2018 - Present (7 years)',
      highlights: [
        'Building 7 AI-powered SaaS platforms',
        'Developed 10,000+ unique NFTs with 100% trait uniqueness',
        'Created AI automation reducing manual tasks by 60%',
        'Full-stack development: React, TypeScript, Supabase, AI integration'
      ]
    },
    {
      company: 'Infomax Office Systems',
      role: 'Solutions and Production Consultant',
      duration: 'January 2024 - Present',
      highlights: [
        'Leading technical solutions and production optimization',
        'Managing team of 10 direct reports',
        'Driving digital transformation initiatives'
      ]
    },
    {
      company: 'USA TODAY NETWORK',
      role: 'Sales Solutions Consultant',
      duration: 'April 2022 - June 2024 (2 years)',
      highlights: [
        'Exceeded sales quotas by 20% within six months',
        'Maintained 90% customer retention rate',
        'Consulted on digital marketing solutions'
      ]
    },
    {
      company: 'XSport Fitness',
      role: 'Regional Director',
      duration: '5 years 8 months',
      highlights: [
        'Managed 29 locations as Regional Director',
        'Drove over $600K in monthly sales',
        'Built and led high-performing teams'
      ]
    }
  ];

  const certifications = [
    'PaperCut Certified',
    'Canon UniFlow Certified',
    'PrinterLogic Certified',
    'Notary Public'
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="About Dan Pearson | AI Engineer & Business Development Expert Background"
        description="Learn about Dan Pearson's 15+ years of experience in AI engineering, business development, and NFT development. Discover his expertise in AI integration, sales leadership, and innovative tech solutions."
        keywords="Dan Pearson bio, AI engineer background, business development expert, NFT developer experience, AI integration specialist, sales leadership, tech innovation career"
        url="https://danpearson.net/about"
        type="website"
        structuredData={{
          type: 'person',
          data: {
            name: 'Dan Pearson',
            jobTitle: 'AI Engineer & Business Development Expert',
            description: 'Experienced AI engineer and business development leader with 15+ years of expertise in AI integration, NFT development, and sales leadership.',
            url: 'https://danpearson.net/about',
            image: profile?.profile_photo_url || '/placeholder.svg',
            sameAs: [
              profile?.linkedin_url || 'https://linkedin.com/in/danpearson',
              profile?.github_url || 'https://github.com/danpearson'
            ],
            worksFor: {
              '@type': 'Organization',
              name: 'Pearson Media LLC'
            },
            knowsAbout: [
              'Artificial Intelligence',
              'Business Development',
              'NFT Development',
              'Sales Leadership',
              'React Development',
              'Machine Learning'
            ]
          }
        }}
      />
      <Navigation />
      <main id="main-content" className="flex-1 pt-20 sm:pt-24 mobile-container">
        <div className="container mx-auto mobile-section">
          <div className="max-w-5xl mx-auto">
            {/* Header with Photo */}
            <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
              <div className="mx-auto md:mx-0 flex-shrink-0">
                <div className="relative">
                  <img
                    src={profile?.profile_photo_url || '/placeholder.svg'}
                    alt="Dan Pearson"
                    className="w-48 h-48 rounded-full object-cover border-4 border-primary/20 shadow-2xl shadow-primary/20"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                    Available
                  </div>
                </div>
              </div>

              <div className="flex-1 text-center md:text-left">
                <h1 className="mobile-heading-lg hero-gradient-text mb-4">
                  Dan Pearson
                </h1>
                <p className="text-xl sm:text-2xl text-primary font-semibold mb-4">
                  {profile?.bio_headline || 'Bridging the gap between sales and technology'}
                </p>
                <p className="mobile-body text-muted-foreground mb-6 max-w-2xl">
                  {profile?.bio_subheadline || 'With 15+ years closing deals and a passion for AI-powered automation, I build products that actually sell.'}
                </p>

                <div className="flex flex-wrap gap-4 justify-center md:justify-start items-center text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span>{profile?.location || 'Des Moines Metropolitan Area'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-primary" />
                    <span>{profile?.years_experience || 15}+ years experience</span>
                  </div>
                </div>

                {/* Social Links */}
                <div className="flex gap-3 mt-6 justify-center md:justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(profile?.linkedin_url || 'https://www.linkedin.com/in/danpearson', '_blank')}
                  >
                    <Linkedin className="w-4 h-4 mr-2" />
                    LinkedIn
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(profile?.github_url || 'https://github.com/danpearson', '_blank')}
                  >
                    <Github className="w-4 h-4 mr-2" />
                    GitHub
                  </Button>
                </div>
              </div>
            </div>

            {/* My Story */}
            <Card className="mb-10 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardContent className="mobile-card">
                <h2 className="mobile-heading-sm mb-4 flex items-center gap-2">
                  <Award className="w-6 h-6 text-primary" />
                  My Story
                </h2>
                <div className="prose prose-gray dark:prose-invert max-w-none space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    I've spent <strong className="text-foreground">15+ years in sales and business development</strong>, closing millions in deals and building high-performing teams. But I've always been driven by a deeper question: <em>How can technology make business better?</em>
                  </p>
                  <p>
                    That curiosity led me from managing 29 fitness locations and driving $600K+ in monthly sales to teaching myself full-stack development. I didn't just want to sell technology—I wanted to <strong className="text-foreground">build it</strong>.
                  </p>
                  <p>
                    Today, I combine my sales expertise with technical skills to create <strong className="text-foreground">AI-powered solutions that actually drive revenue</strong>. I understand both sides of the equation: what businesses need <em>and</em> how to build it.
                  </p>
                  <p>
                    Currently, I'm building <strong className="text-foreground">7 SaaS platforms</strong> under Pearson Media LLC while consulting at Infomax Office Systems. Whether it's generating 10,000 unique NFTs, automating 60% of business tasks with AI, or leading teams to exceed quotas by 20%—I thrive at the intersection of sales and technology.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Key Achievements */}
            <div className="mb-10">
              <h2 className="mobile-heading-sm mb-6 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-primary" />
                Key Achievements
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {achievements.map((achievement, idx) => {
                  const IconComponent = achievement.icon;
                  return (
                    <Card key={idx} className="border-border bg-card/50 hover:border-primary/30 transition-colors">
                      <CardContent className="p-4 flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <IconComponent className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground mb-1">
                            {achievement.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {achievement.company}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Professional Experience */}
            <div className="mb-10">
              <h2 className="mobile-heading-sm mb-6 flex items-center gap-2">
                <Briefcase className="w-6 h-6 text-primary" />
                Professional Experience
              </h2>
              <div className="space-y-6">
                {experience.map((job, idx) => (
                  <Card key={idx} className="border-border bg-card/50 hover:border-primary/30 transition-colors">
                    <CardContent className="mobile-card">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">
                            {job.role}
                          </h3>
                          <p className="text-base text-primary font-semibold">
                            {job.company}
                          </p>
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap ml-4">
                          {job.duration}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {job.highlights.map((highlight, hidx) => (
                          <li key={hidx} className="text-sm text-muted-foreground flex items-start">
                            <span className="text-primary mr-2 mt-1 flex-shrink-0">•</span>
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Education & Certifications */}
            <div className="grid md:grid-cols-2 gap-6 mb-10">
              <Card className="border-border bg-card/50 hover:border-primary/30 transition-colors">
                <CardContent className="mobile-card">
                  <h2 className="mobile-heading-sm mb-4 flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-primary" />
                    Education
                  </h2>
                  <div>
                    <p className="font-semibold text-foreground">Bachelor of Science (BS)</p>
                    <p className="text-sm text-muted-foreground">Northern Illinois University</p>
                    <p className="text-sm text-muted-foreground">Graduated May 2009</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50 hover:border-primary/30 transition-colors">
                <CardContent className="mobile-card">
                  <h2 className="mobile-heading-sm mb-4 flex items-center gap-2">
                    <Award className="w-6 h-6 text-primary" />
                    Certifications
                  </h2>
                  <ul className="space-y-2">
                    {certifications.map((cert, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-center">
                        <span className="text-primary mr-2">✓</span>
                        {cert}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Technical Expertise */}
            <Card className="mb-10 border-border bg-card/50">
              <CardContent className="mobile-card">
                <h2 className="mobile-heading-sm mb-4">Technical Expertise</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    'React & TypeScript',
                    'Node.js & Python',
                    'Supabase & PostgreSQL',
                    'AI/ML Integration',
                    'NFT Development',
                    'Blockchain',
                    'Full-Stack Development',
                    'Cloud Architecture',
                    'DevOps & CI/CD',
                    'RESTful APIs',
                    'Database Design',
                    'UI/UX Design'
                  ].map((skill, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 text-sm rounded bg-primary/10 text-primary border border-primary/20 text-center"
                    >
                      {skill}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* CTA Section */}
            <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/30">
              <CardContent className="mobile-card text-center">
                <h3 className="mobile-heading-sm mb-4">Let's Work Together</h3>
                <p className="text-base text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Whether you need AI integration, full-stack development, or sales strategy consulting—I bring a unique perspective that combines technical expertise with proven business results.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="btn-futuristic"
                    onClick={() => window.location.href = '/connect'}
                  >
                    Get In Touch
                    <ExternalLink className="w-5 h-5 ml-2" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => window.location.href = '/projects'}
                  >
                    View My Work
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
