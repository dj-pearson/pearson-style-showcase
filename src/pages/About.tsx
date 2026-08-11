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
  Github,
  LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Map icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  TrendingUp,
  Users,
  Award,
  Briefcase,
};

interface Achievement {
  id: string;
  label: string;
  company: string | null;
  icon_name: string;
  display_order: number;
}

interface WorkExperience {
  id: string;
  company: string;
  role: string;
  duration: string;
  highlights: string[];
  display_order: number;
}

interface Certification {
  id: string;
  name: string;
  display_order: number;
}

const About = () => {
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_settings')
        .select(
          'profile_photo_url, bio_headline, bio_subheadline, location, years_experience, linkedin_url, github_url'
        )
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch achievements from database
  const { data: achievements = [], isLoading: isAchievementsLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('status', 'published')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as Achievement[];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch work experience from database
  const { data: experience = [], isLoading: isExperienceLoading } = useQuery({
    queryKey: ['work-experience'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_experience')
        .select('*')
        .eq('status', 'published')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as WorkExperience[];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch certifications from database
  const { data: certifications = [], isLoading: isCertificationsLoading } = useQuery({
    queryKey: ['certifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certifications')
        .select('*')
        .eq('status', 'published')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as Certification[];
    },
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="About Dan Pearson | AI CRM Automation Consultant"
        description="Fifteen years in sales and business development — including managing 29 fitness locations at $600K+ monthly — before building seven SaaS platforms and moving into AI CRM automation. The rare consultant who has carried a quota and written the automation."
        keywords="Dan Pearson bio, AI CRM automation consultant, CRM automation background, sales leadership, revenue operations, SaaS founder, Pearson Media LLC"
        url="https://danpearson.net/about"
        type="website"
        structuredData={{
          type: 'person',
          data: {
            name: 'Dan Pearson',
            jobTitle: 'AI CRM Automation Consultant',
            description:
              'AI CRM automation consultant with 15+ years in sales and business development, now building capture-layer automation for revenue teams under 50 seats. Founder of Pearson Media LLC and builder of seven SaaS platforms.',
            url: 'https://danpearson.net/about',
            image: profile?.profile_photo_url || '/placeholder.svg',
            sameAs: [
              profile?.linkedin_url || 'https://linkedin.com/in/danpearson',
              profile?.github_url || 'https://github.com/danpearson',
            ],
            worksFor: {
              '@type': 'Organization',
              name: 'Pearson Media LLC',
            },
            knowsAbout: [
              'AI CRM Automation',
              'CRM Data Quality',
              'Sales Pipeline Automation',
              'Revenue Operations',
              'Sales Leadership',
              'SaaS Development',
              'React Development',
            ],
          },
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
                  {isProfileLoading ? (
                    <Skeleton className="w-48 h-48 rounded-full" />
                  ) : (
                    <img
                      src={profile?.profile_photo_url || '/placeholder.svg'}
                      alt="Dan Pearson"
                      className="w-48 h-48 rounded-full object-cover border-4 border-primary/20 shadow-2xl shadow-primary/20"
                    />
                  )}
                  <div className="absolute -bottom-2 -right-2 bg-green-700 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                    Available
                  </div>
                </div>
              </div>

              <div className="flex-1 text-center md:text-left">
                <h1 className="mobile-heading-lg hero-gradient-text mb-4">Dan Pearson</h1>
                {isProfileLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-3/4 mx-auto md:mx-0" />
                    <Skeleton className="h-5 w-full max-w-2xl mx-auto md:mx-0" />
                    <Skeleton className="h-5 w-2/3 max-w-2xl mx-auto md:mx-0" />
                    <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-5 w-36" />
                    </div>
                    <div className="flex gap-3 mt-6 justify-center md:justify-start">
                      <Skeleton className="h-9 w-24" />
                      <Skeleton className="h-9 w-20" />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xl sm:text-2xl text-primary font-semibold mb-4">
                      {profile?.bio_headline || 'Bridging the gap between sales and technology'}
                    </p>
                    <p className="mobile-body text-muted-foreground mb-6 max-w-2xl">
                      {profile?.bio_subheadline ||
                        'With 15+ years closing deals and a passion for AI-powered automation, I build products that actually sell.'}
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
                        onClick={() =>
                          window.open(
                            profile?.linkedin_url || 'https://www.linkedin.com/in/danpearson',
                            '_blank'
                          )
                        }
                        aria-label="Visit LinkedIn profile (opens in new tab)"
                      >
                        <Linkedin className="w-4 h-4 mr-2" aria-hidden="true" />
                        LinkedIn
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            profile?.github_url || 'https://github.com/danpearson',
                            '_blank'
                          )
                        }
                        aria-label="Visit GitHub profile (opens in new tab)"
                      >
                        <Github className="w-4 h-4 mr-2" aria-hidden="true" />
                        GitHub
                      </Button>
                    </div>
                  </>
                )}
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
                    I've spent{' '}
                    <strong className="text-foreground">
                      15+ years in sales and business development
                    </strong>{' '}
                    — including managing 29 fitness locations and driving $600K+ in monthly sales.
                    That is where this work started, and it matters more than it sounds: I have
                    personally lost deals because the CRM said something that was not true.
                  </p>
                  <p>
                    Rather than keep complaining about the tooling, I taught myself full-stack
                    development. I didn't just want to sell technology—I wanted to{' '}
                    <strong className="text-foreground">build it</strong>.
                  </p>
                  <p>
                    Today I build{' '}
                    <strong className="text-foreground">AI automation inside the CRM</strong> for
                    revenue teams under 50 seats. The argument I keep making is that most AI CRM
                    projects fail because they automate the reporting layer — dashboards, forecasts,
                    scoring — instead of the capture layer that feeds it. Fix capture, and the rest
                    starts working on its own.
                  </p>
                  <p>
                    Alongside that I'm building{' '}
                    <strong className="text-foreground">7 SaaS platforms</strong> under Pearson
                    Media LLC while consulting at Infomax Office Systems. Those platforms span
                    construction, real estate, fitness and meal planning, which is four industries'
                    worth of genuinely messy real-world sales data — the best education in revenue
                    systems I could have asked for.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Key Achievements */}
            {isAchievementsLoading ? (
              <div className="mb-10">
                <h2 className="mobile-heading-sm mb-6 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  Key Achievements
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="border-border bg-card/50">
                      <CardContent className="p-4 flex items-start gap-3">
                        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              achievements.length > 0 && (
                <div className="mb-10">
                  <h2 className="mobile-heading-sm mb-6 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-primary" />
                    Key Achievements
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {achievements.map((achievement) => {
                      const IconComponent = iconMap[achievement.icon_name] || TrendingUp;
                      return (
                        <Card
                          key={achievement.id}
                          className="border-border bg-card/50 hover:border-primary/30 transition-colors"
                        >
                          <CardContent className="p-4 flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <IconComponent className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground mb-1">
                                {achievement.label}
                              </p>
                              {achievement.company && (
                                <p className="text-xs text-muted-foreground">
                                  {achievement.company}
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {/* Professional Experience */}
            {isExperienceLoading ? (
              <div className="mb-10">
                <h2 className="mobile-heading-sm mb-6 flex items-center gap-2">
                  <Briefcase className="w-6 h-6 text-primary" />
                  Professional Experience
                </h2>
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="border-border bg-card/50">
                      <CardContent className="mobile-card">
                        <div className="flex justify-between items-start mb-4">
                          <div className="space-y-2">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-5/6" />
                          <Skeleton className="h-4 w-4/5" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              experience.length > 0 && (
                <div className="mb-10">
                  <h2 className="mobile-heading-sm mb-6 flex items-center gap-2">
                    <Briefcase className="w-6 h-6 text-primary" />
                    Professional Experience
                  </h2>
                  <div className="space-y-6">
                    {experience.map((job) => (
                      <Card
                        key={job.id}
                        className="border-border bg-card/50 hover:border-primary/30 transition-colors"
                      >
                        <CardContent className="mobile-card">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-bold text-foreground">{job.role}</h3>
                              <p className="text-base text-primary font-semibold">{job.company}</p>
                            </div>
                            <span className="text-sm text-muted-foreground whitespace-nowrap ml-4">
                              {job.duration}
                            </span>
                          </div>
                          {job.highlights && job.highlights.length > 0 && (
                            <ul className="space-y-2">
                              {job.highlights.map((highlight, hidx) => (
                                <li
                                  key={hidx}
                                  className="text-sm text-muted-foreground flex items-start"
                                >
                                  <span className="text-primary mr-2 mt-1 flex-shrink-0">•</span>
                                  <span>{highlight}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            )}

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

              {isCertificationsLoading ? (
                <Card className="border-border bg-card/50">
                  <CardContent className="mobile-card">
                    <h2 className="mobile-heading-sm mb-4 flex items-center gap-2">
                      <Award className="w-6 h-6 text-primary" />
                      Certifications
                    </h2>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                certifications.length > 0 && (
                  <Card className="border-border bg-card/50 hover:border-primary/30 transition-colors">
                    <CardContent className="mobile-card">
                      <h2 className="mobile-heading-sm mb-4 flex items-center gap-2">
                        <Award className="w-6 h-6 text-primary" />
                        Certifications
                      </h2>
                      <ul className="space-y-2">
                        {certifications.map((cert) => (
                          <li
                            key={cert.id}
                            className="text-sm text-muted-foreground flex items-center"
                          >
                            <span className="text-primary mr-2">✓</span>
                            {cert.name}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )
              )}
            </div>

            {/* Technical Expertise */}
            <Card className="mb-10 border-border bg-card/50">
              <CardContent className="mobile-card">
                <h2 className="mobile-heading-sm mb-4">Technical Expertise</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    'CRM Integration & APIs',
                    'AI/ML Integration',
                    'React & TypeScript',
                    'Node.js & Python',
                    'Supabase & PostgreSQL',
                    'Workflow Automation',
                    'Full-Stack Development',
                    'Cloud Architecture',
                    'DevOps & CI/CD',
                    'RESTful APIs',
                    'Database Design',
                    'UI/UX Design',
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
                  Whether you need AI integration, full-stack development, or sales strategy
                  consulting—I bring a unique perspective that combines technical expertise with
                  proven business results.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="btn-futuristic"
                    onClick={() => (window.location.href = '/connect')}
                  >
                    Get In Touch
                    <ExternalLink className="w-5 h-5 ml-2" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => (window.location.href = '/projects')}
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
