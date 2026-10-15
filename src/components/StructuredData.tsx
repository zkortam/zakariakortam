export function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Zakaria Kortam",
    "url": "https://www.zakariakortam.com",
    "image": "https://www.zakariakortam.com/zakaria.png",
    "sameAs": [
      "https://linkedin.com/in/zkortam",
      "https://x.com/zakariakortam",
      "https://github.com/zkortam"
    ],
    "jobTitle": "Associate Product Manager, Innovation",
    "worksFor": {
      "@type": "Organization",
      "name": "DigiCert"
    },
    "alumniOf": [
      { "@type": "CollegeOrUniversity", "name": "UC San Diego", "department": "Electrical Engineering" },
      { "@type": "CollegeOrUniversity", "name": "Evergreen Valley College" }
    ],
    "knowsAbout": [
      "Artificial Intelligence",
      "Machine Learning",
      "Product Management",
      "Product Engineering",
      "Agentic AI",
      "Full Stack Development",
      "React",
      "TypeScript",
      "Python"
    ],
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "San Jose",
      "addressRegion": "CA",
      "addressCountry": "US"
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}
