import { project, type SupportedLocale } from "@repo/config";
import merge from "lodash.merge";
import type { Metadata } from "next";

type MetadataGenerator = Omit<Metadata, "description" | "title"> & {
  title: string;
  description: string;
  image?: string;
  locale?: SupportedLocale;
};

const openGraphLocales: Record<SupportedLocale, string> = {
  ar: "ar_IQ",
  ckb: "ckb_IQ",
  en: "en_US",
};

const applicationName = project.name;
const author: Metadata["authors"] = {
  name: project.orgName,
  url: project.url,
};
const publisher = project.orgName;
const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

const getMetadataBase = () => {
  if (productionUrl) {
    return new URL(`${protocol}://${productionUrl}`);
  }

  return project.url ? new URL(project.url) : undefined;
};

export const createMetadata = ({
  title,
  description,
  image,
  locale = project.locale.default,
  ...properties
}: MetadataGenerator): Metadata => {
  const parsedTitle = `${title} | ${applicationName}`;
  const defaultMetadata: Metadata = {
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: parsedTitle,
    },
    applicationName,
    authors: [author],
    creator: author.name,
    description,
    formatDetection: {
      telephone: false,
    },
    metadataBase: getMetadataBase(),
    openGraph: {
      description,
      locale: openGraphLocales[locale],
      siteName: applicationName,
      title: parsedTitle,
      type: "website",
    },
    publisher,
    title: parsedTitle,
    twitter: {
      card: "summary_large_image",
    },
  };

  const metadata: Metadata = merge(defaultMetadata, properties);

  if (image && metadata.openGraph) {
    metadata.openGraph.images = [
      {
        alt: title,
        height: 630,
        url: image,
        width: 1200,
      },
    ];
  }

  return metadata;
};
