import { motion } from "motion/react";
import { Shield, FileText, Image, Video, Link as LinkIcon, ArrowRight, CheckCircle, AlertTriangle, TrendingUp, Users, DollarSign, Upload, Scan, BarChart3, Share2, Clock } from "lucide-react";
import { Link as RouterLink } from "react-router";

export default function Landing() {
  const features = [
    {
      icon: FileText,
      title: "Text Analysis",
      description: "Detect misinformation in articles and news content",
    },
    {
      icon: Image,
      title: "Image Detection",
      description: "Identify AI-generated and manipulated images",
    },
    {
      icon: Video,
      title: "Video Verification",
      description: "Expose deepfakes and synthetic media",
    },
    {
      icon: LinkIcon,
      title: "URL Checker",
      description: "Verify domain reputation and source credibility",
    },
  ];

  const benefits = [
    "Real-time AI-powered analysis",
    "Multi-modal detection capabilities",
    "Detailed confidence scores",
    "Comprehensive explanations",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 size-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 size-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/30">
              <Shield className="size-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              VeritasAI
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <RouterLink
              to="/login"
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </RouterLink>
            <RouterLink
              to="/signup"
              className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
            >
              Get Started
            </RouterLink>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-sm mb-6">
            Multi-Modal Misinformation Detection
          </div>
          <h2 className="text-6xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent mb-6">
            Combat Misinformation
            <br />
            with AI-Powered Analysis
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Advanced detection system for identifying fake news, deepfakes, and manipulated media across multiple formats
          </p>
          <div className="flex items-center justify-center gap-4">
            <RouterLink
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105"
            >
              Start Detecting Now
              <ArrowRight className="size-5" />
            </RouterLink>
          </div>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16"
        >
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="flex items-center gap-2 justify-center text-gray-300"
            >
              <CheckCircle className="size-5 text-cyan-400" />
              <span className="text-sm">{benefit}</span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Impact Statistics Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-sm mb-6">
              <AlertTriangle className="size-4" />
              <span>The Global Threat of Misinformation</span>
            </div>
            <h3 className="text-4xl font-bold text-white mb-4">
              The Real Impact of Deepfakes & Misinformation
            </h3>
            <p className="text-gray-400 max-w-3xl mx-auto">
              Synthetic media and AI-generated content pose unprecedented risks to individuals, businesses, and democracies worldwide
            </p>
          </div>

          {/* Statistics Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-red-950/40 to-red-900/20 rounded-2xl border border-red-500/30 p-6 shadow-xl backdrop-blur-sm"
            >
              <TrendingUp className="size-10 text-red-400 mb-4" />
              <div className="text-4xl font-bold text-red-400 mb-2">900%</div>
              <p className="text-gray-300 text-sm mb-2">Increase in deepfakes</p>
              <p className="text-gray-500 text-xs">Since 2019 (Deeptrace, 2023)</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-orange-950/40 to-orange-900/20 rounded-2xl border border-orange-500/30 p-6 shadow-xl backdrop-blur-sm"
            >
              <DollarSign className="size-10 text-orange-400 mb-4" />
              <div className="text-4xl font-bold text-orange-400 mb-2">$78B</div>
              <p className="text-gray-300 text-sm mb-2">Annual fraud losses</p>
              <p className="text-gray-500 text-xs">AI-enabled scams (FBI IC3, 2024)</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-yellow-950/40 to-yellow-900/20 rounded-2xl border border-yellow-500/30 p-6 shadow-xl backdrop-blur-sm"
            >
              <Users className="size-10 text-yellow-400 mb-4" />
              <div className="text-4xl font-bold text-yellow-400 mb-2">73%</div>
              <p className="text-gray-300 text-sm mb-2">Can't identify deepfakes</p>
              <p className="text-gray-500 text-xs">Of surveyed adults (MIT, 2023)</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-red-950/40 to-purple-900/20 rounded-2xl border border-purple-500/30 p-6 shadow-xl backdrop-blur-sm"
            >
              <Video className="size-10 text-purple-400 mb-4" />
              <div className="text-4xl font-bold text-purple-400 mb-2">96%</div>
              <p className="text-gray-300 text-sm mb-2">Malicious deepfakes</p>
              <p className="text-gray-500 text-xs">Used for non-consensual content (Sensity AI, 2023)</p>
            </motion.div>
          </div>

          {/* Impact Categories */}
          <div className="grid md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-6 shadow-xl backdrop-blur-sm"
            >
              <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="size-6 text-cyan-400" />
                Personal Security Threats
              </h4>
              <ul className="space-y-3 text-gray-300 text-sm">
                <li className="flex items-start gap-2">
                  <div className="size-1.5 rounded-full bg-red-500 mt-2"></div>
                  <span><strong>Identity theft:</strong> Deepfake voice cloning used in $35M+ fraud cases (Europol, 2024)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="size-1.5 rounded-full bg-red-500 mt-2"></div>
                  <span><strong>Reputation damage:</strong> 68% of victims experience severe psychological harm (Pew Research, 2023)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="size-1.5 rounded-full bg-red-500 mt-2"></div>
                  <span><strong>Non-consensual media:</strong> 143,000 deepfake videos identified online in 2023 alone</span>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-6 shadow-xl backdrop-blur-sm"
            >
              <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="size-6 text-orange-400" />
                Business & Economic Impact
              </h4>
              <ul className="space-y-3 text-gray-300 text-sm">
                <li className="flex items-start gap-2">
                  <div className="size-1.5 rounded-full bg-orange-500 mt-2"></div>
                  <span><strong>CEO fraud:</strong> Average loss of $1.8M per deepfake voice scam (Gartner, 2023)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="size-1.5 rounded-full bg-orange-500 mt-2"></div>
                  <span><strong>Stock manipulation:</strong> Fake news causes $400B+ in market volatility annually (IMF, 2024)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="size-1.5 rounded-full bg-orange-500 mt-2"></div>
                  <span><strong>Brand impersonation:</strong> 83% increase in synthetic media brand attacks (World Economic Forum, 2024)</span>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.7 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-6 shadow-xl backdrop-blur-sm"
            >
              <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="size-6 text-purple-400" />
                Democratic & Social Impact
              </h4>
              <ul className="space-y-3 text-gray-300 text-sm">
                <li className="flex items-start gap-2">
                  <div className="size-1.5 rounded-full bg-purple-500 mt-2"></div>
                  <span><strong>Election interference:</strong> Deepfakes detected in 47 countries during 2024 elections (Oxford Internet Institute)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="size-1.5 rounded-full bg-purple-500 mt-2"></div>
                  <span><strong>Eroded trust:</strong> 59% doubt authenticity of all online content (Edelman Trust Barometer, 2024)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="size-1.5 rounded-full bg-purple-500 mt-2"></div>
                  <span><strong>Social polarization:</strong> AI-generated disinformation increases division by 34% (Stanford Research, 2023)</span>
                </li>
              </ul>
            </motion.div>
          </div>

          {/* Call to Action Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="mt-12 bg-gradient-to-r from-red-950/30 via-orange-950/30 to-yellow-950/30 rounded-2xl border border-red-500/30 p-8 text-center backdrop-blur-sm"
          >
            <AlertTriangle className="size-12 text-red-400 mx-auto mb-4" />
            <h4 className="text-2xl font-bold text-white mb-3">The Threat is Real. The Solution is Here.</h4>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              With deepfake technology becoming more accessible and sophisticated, detection tools are no longer optional—they're essential for personal safety, business security, and societal integrity.
            </p>
            <RouterLink
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105"
            >
              Protect Yourself with VeritasAI
              <ArrowRight className="size-5" />
            </RouterLink>
          </motion.div>

          {/* Sources Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1 }}
            className="mt-8 pt-6 border-t border-gray-800/50"
          >
            <p className="text-xs text-gray-500 text-center">
              <strong>Data Sources:</strong> Deeptrace Research, FBI Internet Crime Complaint Center (IC3), MIT Media Lab, Sensity AI, Europol Cybercrime Centre, 
              Pew Research Center, Gartner Security & Risk Management, International Monetary Fund (IMF), World Economic Forum, 
              Oxford Internet Institute, Edelman Trust Barometer, Stanford Internet Observatory (2023-2024)
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h3 className="text-4xl font-bold text-white mb-4">Powerful Detection Features</h3>
          <p className="text-gray-400">Everything you need to verify content authenticity</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index, duration: 0.5 }}
                className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-6 shadow-xl hover:shadow-cyan-500/10 hover:border-cyan-500/30 transition-all backdrop-blur-sm group"
              >
                <div className="p-3 bg-cyan-500/10 rounded-xl inline-block mb-4 group-hover:bg-cyan-500/20 transition-colors">
                  <Icon className="size-8 text-cyan-400" />
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">{feature.title}</h4>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-sm mb-6">
              <Shield className="size-4" />
              <span>Simple 4-Step Process</span>
            </div>
            <h3 className="text-4xl font-bold text-white mb-4">
              How VeritasAI Works
            </h3>
            <p className="text-gray-400 max-w-3xl mx-auto">
              Our advanced AI-powered system analyzes content across multiple dimensions to detect misinformation, deepfakes, and manipulated media with precision
            </p>
          </div>

          {/* Process Steps */}
          <div className="grid md:grid-cols-4 gap-6 mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-cyan-950/40 to-cyan-900/20 rounded-2xl border border-cyan-500/30 p-6 shadow-xl backdrop-blur-sm">
                <div className="flex items-center justify-center size-16 bg-cyan-500/20 rounded-full mb-4 mx-auto">
                  <Upload className="size-8 text-cyan-400" />
                </div>
                <div className="text-center">
                  <div className="inline-block px-3 py-1 bg-cyan-500/20 rounded-full text-cyan-400 text-xs font-semibold mb-3">
                    STEP 1
                  </div>
                  <h4 className="text-xl font-semibold text-white mb-2">Upload Content</h4>
                  <p className="text-gray-400 text-sm">
                    Submit text, images, videos, or URLs for analysis through our intuitive interface
                  </p>
                </div>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-3 size-6 bg-cyan-500/20 rounded-full border-4 border-gray-950"></div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-blue-950/40 to-blue-900/20 rounded-2xl border border-blue-500/30 p-6 shadow-xl backdrop-blur-sm">
                <div className="flex items-center justify-center size-16 bg-blue-500/20 rounded-full mb-4 mx-auto">
                  <Scan className="size-8 text-blue-400" />
                </div>
                <div className="text-center">
                  <div className="inline-block px-3 py-1 bg-blue-500/20 rounded-full text-blue-400 text-xs font-semibold mb-3">
                    STEP 2
                  </div>
                  <h4 className="text-xl font-semibold text-white mb-2">AI Analysis</h4>
                  <p className="text-gray-400 text-sm">
                    Multi-layered AI models scan for manipulation patterns, inconsistencies, and authenticity markers
                  </p>
                </div>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-3 size-6 bg-blue-500/20 rounded-full border-4 border-gray-950"></div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-purple-950/40 to-purple-900/20 rounded-2xl border border-purple-500/30 p-6 shadow-xl backdrop-blur-sm">
                <div className="flex items-center justify-center size-16 bg-purple-500/20 rounded-full mb-4 mx-auto">
                  <BarChart3 className="size-8 text-purple-400" />
                </div>
                <div className="text-center">
                  <div className="inline-block px-3 py-1 bg-purple-500/20 rounded-full text-purple-400 text-xs font-semibold mb-3">
                    STEP 3
                  </div>
                  <h4 className="text-xl font-semibold text-white mb-2">Get Results</h4>
                  <p className="text-gray-400 text-sm">
                    Receive detailed reports with confidence scores, visual gauges, and comprehensive explanations
                  </p>
                </div>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-3 size-6 bg-purple-500/20 rounded-full border-4 border-gray-950"></div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
            >
              <div className="bg-gradient-to-br from-green-950/40 to-green-900/20 rounded-2xl border border-green-500/30 p-6 shadow-xl backdrop-blur-sm">
                <div className="flex items-center justify-center size-16 bg-green-500/20 rounded-full mb-4 mx-auto">
                  <Share2 className="size-8 text-green-400" />
                </div>
                <div className="text-center">
                  <div className="inline-block px-3 py-1 bg-green-500/20 rounded-full text-green-400 text-xs font-semibold mb-3">
                    STEP 4
                  </div>
                  <h4 className="text-xl font-semibold text-white mb-2">Share & Protect</h4>
                  <p className="text-gray-400 text-sm">
                    Share verified results on social media and help combat the spread of misinformation
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Detection Methods Details */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Text Analysis */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-8 shadow-xl backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-cyan-500/10 rounded-xl">
                  <FileText className="size-8 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-2xl font-semibold text-white">Text Analysis</h4>
                  <p className="text-gray-400 text-sm">Natural Language Processing</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-cyan-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Sentiment Analysis</p>
                    <p className="text-gray-400 text-sm">Detects emotionally manipulative language and sensationalism</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-cyan-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Source Verification</p>
                    <p className="text-gray-400 text-sm">Cross-references claims with credible databases</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-cyan-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Pattern Recognition</p>
                    <p className="text-gray-400 text-sm">Identifies known misinformation tactics and propaganda techniques</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-cyan-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Fact-Checking</p>
                    <p className="text-gray-400 text-sm">Validates statistical claims and quoted information</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Image Detection */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-8 shadow-xl backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-500/10 rounded-xl">
                  <Image className="size-8 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-2xl font-semibold text-white">Image Detection</h4>
                  <p className="text-gray-400 text-sm">Computer Vision Analysis</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-purple-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">AI-Generated Detection</p>
                    <p className="text-gray-400 text-sm">Identifies synthetic images from GANs, Stable Diffusion, DALL-E</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-purple-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Manipulation Analysis</p>
                    <p className="text-gray-400 text-sm">Detects photoshopping, cloning, splicing, and retouching</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-purple-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Metadata Verification</p>
                    <p className="text-gray-400 text-sm">Examines EXIF data, timestamps, and editing history</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-purple-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Heat Map Visualization</p>
                    <p className="text-gray-400 text-sm">Shows manipulated regions with visual overlays</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Video Detection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.7 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-8 shadow-xl backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-red-500/10 rounded-xl">
                  <Video className="size-8 text-red-400" />
                </div>
                <div>
                  <h4 className="text-2xl font-semibold text-white">Video Detection</h4>
                  <p className="text-gray-400 text-sm">Deepfake & Synthetic Media</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Facial Recognition Analysis</p>
                    <p className="text-gray-400 text-sm">Detects face-swap deepfakes and lip-sync inconsistencies</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Audio-Visual Sync</p>
                    <p className="text-gray-400 text-sm">Verifies alignment between audio waveforms and mouth movements</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Frame-by-Frame Analysis</p>
                    <p className="text-gray-400 text-sm">Examines temporal inconsistencies and artifacts across frames</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Neural Network Detection</p>
                    <p className="text-gray-400 text-sm">Identifies AI-generated video signatures and compression patterns</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* URL Checker */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-8 shadow-xl backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-orange-500/10 rounded-xl">
                  <LinkIcon className="size-8 text-orange-400" />
                </div>
                <div>
                  <h4 className="text-2xl font-semibold text-white">URL Checker</h4>
                  <p className="text-gray-400 text-sm">Source Credibility Verification</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-orange-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Domain Reputation</p>
                    <p className="text-gray-400 text-sm">Checks registration age, hosting history, and blacklist status</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-orange-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">SSL & Security</p>
                    <p className="text-gray-400 text-sm">Verifies encryption certificates and secure connections</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-orange-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Content Analysis</p>
                    <p className="text-gray-400 text-sm">Scans for clickbait, content farms, and misinformation patterns</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-orange-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium mb-1">Redirect Detection</p>
                    <p className="text-gray-400 text-sm">Identifies suspicious redirects and phishing attempts</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Technology Stack */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.9 }}
            className="mt-12 bg-gradient-to-br from-gray-800/30 to-gray-900/30 rounded-2xl border border-gray-700/30 p-8 backdrop-blur-sm"
          >
            <div className="text-center mb-8">
              <h4 className="text-2xl font-bold text-white mb-3">Powered by Advanced AI Technology</h4>
              <p className="text-gray-400">Cutting-edge machine learning models working in harmony</p>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center size-16 bg-cyan-500/10 rounded-xl mb-3">
                  <Clock className="size-8 text-cyan-400" />
                </div>
                <h5 className="text-white font-semibold mb-2">Real-Time Processing</h5>
                <p className="text-gray-400 text-sm">Analysis completed in seconds</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center size-16 bg-purple-500/10 rounded-xl mb-3">
                  <BarChart3 className="size-8 text-purple-400" />
                </div>
                <h5 className="text-white font-semibold mb-2">95%+ Accuracy</h5>
                <p className="text-gray-400 text-sm">Industry-leading detection rates</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center size-16 bg-blue-500/10 rounded-xl mb-3">
                  <Scan className="size-8 text-blue-400" />
                </div>
                <h5 className="text-white font-semibold mb-2">Multi-Layer Scanning</h5>
                <p className="text-gray-400 text-sm">Comprehensive deep analysis</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center size-16 bg-green-500/10 rounded-xl mb-3">
                  <Shield className="size-8 text-green-400" />
                </div>
                <h5 className="text-white font-semibold mb-2">Continuous Learning</h5>
                <p className="text-gray-400 text-sm">Models updated with latest threats</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="bg-gradient-to-br from-cyan-950/30 to-blue-950/30 rounded-2xl border border-cyan-500/30 p-12 text-center shadow-2xl shadow-cyan-500/10 backdrop-blur-sm"
        >
          <h3 className="text-4xl font-bold text-white mb-4">Ready to Get Started?</h3>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Join VeritasAI today and start protecting yourself from misinformation
          </p>
          <RouterLink
            to="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105"
          >
            Create Free Account
            <ArrowRight className="size-5" />
          </RouterLink>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-gray-500 text-sm">
          <p>© 2026 VeritasAI. All rights reserved. Multi-Modal Misinformation Detection System.</p>
        </div>
      </footer>
    </div>
  );
}