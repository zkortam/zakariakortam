export function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Zakaria Kortam",
    "url": "https://zakariakortam.com",
    "image": "https://zakariakortam.com/og-image.png",
    "sameAs": [
      "https://linkedin.com/in/zkortam",
      "https://x.com/zakariakortam",
      "https://github.com/zkortam"
    ],
    "jobTitle": "AI Engineer",
    "worksFor": {
      "@type": "Organization",
      "name": "Facilis"
    },
    "alumniOf": {
      "@type": "CollegeOrUniversity",
      "name": "UC San Diego",
      "department": "Electrical Engineering"
    },
    "knowsAbout": [
      "Artificial Intelligence",
      "Machine Learning",
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
