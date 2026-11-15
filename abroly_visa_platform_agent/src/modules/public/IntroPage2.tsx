import { motion } from "framer-motion";
import { Briefcase, Star, Users, FileText, ArrowRightCircle } from "lucide-react";


const IntroPage2 = () => {
    return (
        <div className="relative bg-gray-50">
            {/* Dynamic Background */}
            <div className="absolute top-[-150px] right-[-150px] w-[500px] h-[500px] bg-blue-100 rounded-full opacity-70 blur-2xl"></div>
            <div className="absolute bottom-[-200px] left-[-150px] w-[600px] h-[600px] bg-blue-50 rounded-full blur-[100px] opacity-50"></div>

            {/* HERO SECTION */}
            <section className="relative py-20 bg-white">
                <div className="container mx-auto px-6 lg:flex lg:items-center lg:justify-between">
                    {/* Text Content */}
                    <motion.div
                        initial={{ opacity: 0, y: -30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="max-w-xl"
                    >
                        <h1 className="text-5xl font-bold text-gray-800 leading-tight">
                            Empower Your Agency with{" "}
                            <span className="text-blue-600">TechX CRM</span>
                        </h1>
                        <p className="mt-6 text-lg text-gray-600">
                            Streamline visa consultancy, manage clients, and grow your business faster with
                            our powerful CRM tools.
                        </p>
                        <div className="mt-6 flex gap-x-4">
                            <motion.a
                                whileHover={{ scale: 1.05 }}
                                href="#pricing"
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700"
                            >
                                Get Started
                            </motion.a>
                            <motion.a
                                whileHover={{ scale: 1.05 }}
                                href="#features"
                                className="px-6 py-3 border border-blue-600 text-blue-600 rounded-lg shadow-md hover:bg-blue-50"
                            >
                                Learn More
                            </motion.a>
                        </div>
                    </motion.div>

                    {/* Hero Image */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="mt-10 lg:mt-0 lg:w-1/2"
                    >
                        <img
                            src="https://images.pexels.com/photos/3184298/pexels-photo-3184298.jpeg?auto=compress&cs=tinysrgb&w=1200"
                            alt="CRM Dashboard"
                            className="rounded-xl shadow-lg"
                        />
                    </motion.div>
                </div>
            </section>

            {/* VALUE PROPOSITION SECTION */}
            <section id="features" className="py-16 bg-gray-50">
                <div className="container mx-auto px-6">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        viewport={{ once: true }}
                        className="text-4xl font-bold text-gray-800 text-center"
                    >
                        Why Choose TechX CRM?
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        viewport={{ once: true }}
                        className="mt-4 text-lg text-gray-600 text-center"
                    >
                        Tools designed specifically to help agents grow their visa consultancy businesses.
                    </motion.p>

                    <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            {
                                icon: <Briefcase className="w-12 h-12 text-blue-600 mx-auto" />,
                                title: "Lead Management",
                                description:
                                    "Track, organize, and convert leads with powerful analytics and automated workflows.",
                            },
                            {
                                icon: <Star className="w-12 h-12 text-blue-600 mx-auto" />,
                                title: "Client Success Tools",
                                description:
                                    "Provide excellent service with organized client data and progress tracking.",
                            },
                            {
                                icon: <Users className="w-12 h-12 text-blue-600 mx-auto" />,
                                title: "Team Collaboration",
                                description:
                                    "Assign tasks, monitor performance, and work together with efficiency.",
                            },
                            {
                                icon: <FileText className="w-12 h-12 text-blue-600 mx-auto" />,
                                title: "Custom Workflows",
                                description:
                                    "Tailor TechX CRM to your agency's unique needs for maximum productivity.",
                            },
                        ].map((feature, idx) => (
                            <motion.div
                                key={idx}
                                whileHover={{ scale: 1.05 }}
                                className="p-6 bg-white rounded-lg shadow-md text-center"
                            >
                                {feature.icon}
                                <h3 className="mt-4 text-xl font-semibold text-gray-800">{feature.title}</h3>
                                <p className="mt-2 text-gray-600">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* PRICING SECTION */}
            <section id="pricing" className="py-16 bg-white">
                <div className="container mx-auto px-6">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        viewport={{ once: true }}
                        className="text-4xl font-bold text-gray-800 text-center"
                    >
                        Flexible Pricing Plans
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        viewport={{ once: true }}
                        className="mt-4 text-lg text-gray-600 text-center"
                    >
                        Choose a plan that fits your business needs.
                    </motion.p>

                    <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                name: "Starter",
                                price: "$29/month",
                                features: ["Lead Management", "Client Tracking", "Basic Analytics"],
                            },
                            {
                                name: "Pro",
                                price: "$59/month",
                                features: ["Advanced Analytics", "Team Collaboration", "Priority Support"],
                            },
                            {
                                name: "Enterprise",
                                price: "$99/month",
                                features: ["Custom Workflows", "Dedicated Support", "Unlimited Clients"],
                            },
                        ].map((plan, idx) => (
                            <motion.div
                                key={idx}
                                whileHover={{ scale: 1.05 }}
                                className="p-6 bg-gray-50 rounded-lg shadow-md"
                            >
                                <h3 className="text-2xl font-bold text-gray-800">{plan.name}</h3>
                                <p className="mt-2 text-gray-600">{plan.price}</p>
                                <ul className="mt-4 space-y-2">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="text-gray-600">
                                            • {feature}
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    href="#"
                                    className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Subscribe
                                </a>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CALL TO ACTION */}
            <section className="py-12 bg-blue-600 text-white">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold">Ready to Grow Your Business?</h2>
                    <p className="mt-4 text-lg">
                        Join thousands of successful agents using TechX CRM to scale their businesses.
                    </p>
                    <a
                        href="#"
                        className="mt-6 px-6 py-3 bg-white text-blue-600 rounded-lg shadow-md hover:bg-gray-100"
                    >
                        Get Started
                    </a>
                </div>
            </section>
        </div>
    )
}

export default IntroPage2