const GALLERY_START = "<!--ARTIST_GALLERY_START-->";
const GALLERY_END = "<!--ARTIST_GALLERY_END-->";
const SOCIAL_START = "<!--ARTIST_SOCIAL_START-->";
const SOCIAL_END = "<!--ARTIST_SOCIAL_END-->";
const VIDEO_START = "<!--ARTIST_VIDEO_START-->"; // legacy single video block
const VIDEO_END = "<!--ARTIST_VIDEO_END-->"; // legacy single video block
const VIDEO_LIST_START = "<!--ARTIST_VIDEO_LIST_START-->";
const VIDEO_LIST_END = "<!--ARTIST_VIDEO_LIST_END-->";
const CARD_TEXT_START = "<!--ARTIST_CARD_TEXT_START-->";
const CARD_TEXT_END = "<!--ARTIST_CARD_TEXT_END-->";
const CARD_LINES_START = "<!--ARTIST_CARD_LINES_START-->";
const CARD_LINES_END = "<!--ARTIST_CARD_LINES_END-->";
const TURNE_INFO_TITLE_START = "<!--ARTIST_TURNE_INFO_TITLE_START-->";
const TURNE_INFO_TITLE_END = "<!--ARTIST_TURNE_INFO_TITLE_END-->";
const TURNE_INFO_TEXT_START = "<!--ARTIST_TURNE_INFO_TEXT_START-->";
const TURNE_INFO_TEXT_END = "<!--ARTIST_TURNE_INFO_TEXT_END-->";
const TURNE_BANNER_URL_START = "<!--ARTIST_TURNE_BANNER_URL_START-->";
const TURNE_BANNER_URL_END = "<!--ARTIST_TURNE_BANNER_URL_END-->";
const TURNE_EXTERNAL_URL_START = "<!--ARTIST_TURNE_EXTERNAL_URL_START-->";
const TURNE_EXTERNAL_URL_END = "<!--ARTIST_TURNE_EXTERNAL_URL_END-->";

export type ArtistSocialLinks = {
  youtube?: string;
  spotify?: string;
  instagram?: string;
  website?: string;
};

export type ArtistGalleryPosition = "top" | "bottom" | "left" | "right";

export type ArtistGalleryItem = {
  url: string;
  position: ArtistGalleryPosition;
};

export type ArtistProfileData = {
  content: string;
  gallery: ArtistGalleryItem[];
  socials: ArtistSocialLinks;
  videoUrls: string[];
  cardText: string;
  cardLines: number;
  turneInfoTitle: string;
  turneInfoText: string;
  turneBannerUrl: string;
  turneExternalUrl: string;
};

const VALID_POSITIONS: ArtistGalleryPosition[] = ["top", "bottom", "left", "right"];
// Yönetim panelinde birden fazla görsel eklenebildiği için üst limit arttırıldı.
const MAX_GALLERY_ITEMS = 12;

function normalizePosition(value?: string): ArtistGalleryPosition {
  if (!value) return "top";
  const lowered = value.trim().toLowerCase();
  return VALID_POSITIONS.includes(lowered as ArtistGalleryPosition)
    ? (lowered as ArtistGalleryPosition)
    : "top";
}

function normalizeCardLines(value?: number): number {
  const parsed = Number(value || 3);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(6, Math.max(1, Math.round(parsed)));
}

function extractSocialsFromText(content: string): ArtistSocialLinks {
  const socials: ArtistSocialLinks = {};
  const urls = content.match(/https?:\/\/[^\s)]+/gi) || [];

  for (const rawUrl of urls) {
    const url = rawUrl.trim();
    const lowered = url.toLowerCase();
    if (!socials.youtube && (lowered.includes("youtube.com/") || lowered.includes("youtu.be/"))) {
      socials.youtube = url;
      continue;
    }
    if (!socials.spotify && lowered.includes("spotify.com/")) {
      socials.spotify = url;
      continue;
    }
    if (!socials.instagram && lowered.includes("instagram.com/")) {
      socials.instagram = url;
      continue;
    }
    if (
      !socials.website &&
      !lowered.includes("youtube.com/") &&
      !lowered.includes("youtu.be/") &&
      !lowered.includes("spotify.com/") &&
      !lowered.includes("instagram.com/")
    ) {
      socials.website = url;
    }
  }

  return socials;
}

export function parseArtistBio(rawBio?: string | null): ArtistProfileData {
  if (!rawBio) {
    return {
      content: "",
      gallery: [],
      socials: {},
      videoUrls: [],
      cardText: "",
      cardLines: 3,
      turneInfoTitle: "",
      turneInfoText: "",
      turneBannerUrl: "",
      turneExternalUrl: "",
    };
  }

  let working = rawBio;
  const socials: ArtistSocialLinks = {};
  let videoUrls: string[] = [];
  let cardText = "";
  let cardLines = 3;
  let turneInfoTitle = "";
  let turneInfoText = "";
  let turneBannerUrl = "";
  let turneExternalUrl = "";

  const socialStartIdx = working.indexOf(SOCIAL_START);
  const socialEndIdx = working.indexOf(SOCIAL_END);
  if (socialStartIdx !== -1 && socialEndIdx !== -1 && socialEndIdx > socialStartIdx) {
    const socialBlock = working
      .slice(socialStartIdx + SOCIAL_START.length, socialEndIdx)
      .trim();

    socialBlock.split("\n").forEach((line) => {
      const [rawKey, ...rest] = line.split(":");
      const key = rawKey?.trim().toLowerCase();
      const value = rest.join(":").trim();
      if (!value) return;
      if (key === "youtube") socials.youtube = value;
      if (key === "spotify") socials.spotify = value;
      if (key === "instagram") socials.instagram = value;
      if (key === "website") socials.website = value;
    });

    working = `${working.slice(0, socialStartIdx)}${working.slice(
      socialEndIdx + SOCIAL_END.length
    )}`.trim();
  }

  const videoListStartIdx = working.indexOf(VIDEO_LIST_START);
  const videoListEndIdx = working.indexOf(VIDEO_LIST_END);
  if (
    videoListStartIdx !== -1 &&
    videoListEndIdx !== -1 &&
    videoListEndIdx > videoListStartIdx
  ) {
    const videoBlock = working
      .slice(videoListStartIdx + VIDEO_LIST_START.length, videoListEndIdx)
      .trim();
    videoUrls = videoBlock
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5);

    working = `${working.slice(0, videoListStartIdx)}${working.slice(
      videoListEndIdx + VIDEO_LIST_END.length
    )}`.trim();
  } else {
    const videoStartIdx = working.indexOf(VIDEO_START);
    const videoEndIdx = working.indexOf(VIDEO_END);
    if (videoStartIdx !== -1 && videoEndIdx !== -1 && videoEndIdx > videoStartIdx) {
      const legacyVideoUrl = working
        .slice(videoStartIdx + VIDEO_START.length, videoEndIdx)
        .trim();
      videoUrls = legacyVideoUrl ? [legacyVideoUrl] : [];

      working = `${working.slice(0, videoStartIdx)}${working.slice(
        videoEndIdx + VIDEO_END.length
      )}`.trim();
    }
  }

  const cardTextStartIdx = working.indexOf(CARD_TEXT_START);
  const cardTextEndIdx = working.indexOf(CARD_TEXT_END);
  if (
    cardTextStartIdx !== -1 &&
    cardTextEndIdx !== -1 &&
    cardTextEndIdx > cardTextStartIdx
  ) {
    cardText = working
      .slice(cardTextStartIdx + CARD_TEXT_START.length, cardTextEndIdx)
      .trim();

    working = `${working.slice(0, cardTextStartIdx)}${working.slice(
      cardTextEndIdx + CARD_TEXT_END.length
    )}`.trim();
  }

  const cardLinesStartIdx = working.indexOf(CARD_LINES_START);
  const cardLinesEndIdx = working.indexOf(CARD_LINES_END);
  if (
    cardLinesStartIdx !== -1 &&
    cardLinesEndIdx !== -1 &&
    cardLinesEndIdx > cardLinesStartIdx
  ) {
    const rawLines = working
      .slice(cardLinesStartIdx + CARD_LINES_START.length, cardLinesEndIdx)
      .trim();
    cardLines = normalizeCardLines(Number(rawLines));

    working = `${working.slice(0, cardLinesStartIdx)}${working.slice(
      cardLinesEndIdx + CARD_LINES_END.length
    )}`.trim();
  }

  const turneInfoTitleStartIdx = working.indexOf(TURNE_INFO_TITLE_START);
  const turneInfoTitleEndIdx = working.indexOf(TURNE_INFO_TITLE_END);
  if (
    turneInfoTitleStartIdx !== -1 &&
    turneInfoTitleEndIdx !== -1 &&
    turneInfoTitleEndIdx > turneInfoTitleStartIdx
  ) {
    turneInfoTitle = working
      .slice(turneInfoTitleStartIdx + TURNE_INFO_TITLE_START.length, turneInfoTitleEndIdx)
      .trim();
    working = `${working.slice(0, turneInfoTitleStartIdx)}${working.slice(
      turneInfoTitleEndIdx + TURNE_INFO_TITLE_END.length
    )}`.trim();
  }

  const turneInfoTextStartIdx = working.indexOf(TURNE_INFO_TEXT_START);
  const turneInfoTextEndIdx = working.indexOf(TURNE_INFO_TEXT_END);
  if (
    turneInfoTextStartIdx !== -1 &&
    turneInfoTextEndIdx !== -1 &&
    turneInfoTextEndIdx > turneInfoTextStartIdx
  ) {
    turneInfoText = working
      .slice(turneInfoTextStartIdx + TURNE_INFO_TEXT_START.length, turneInfoTextEndIdx)
      .trim();
    working = `${working.slice(0, turneInfoTextStartIdx)}${working.slice(
      turneInfoTextEndIdx + TURNE_INFO_TEXT_END.length
    )}`.trim();
  }

  const turneBannerStartIdx = working.indexOf(TURNE_BANNER_URL_START);
  const turneBannerEndIdx = working.indexOf(TURNE_BANNER_URL_END);
  if (
    turneBannerStartIdx !== -1 &&
    turneBannerEndIdx !== -1 &&
    turneBannerEndIdx > turneBannerStartIdx
  ) {
    turneBannerUrl = working
      .slice(turneBannerStartIdx + TURNE_BANNER_URL_START.length, turneBannerEndIdx)
      .trim();
    working = `${working.slice(0, turneBannerStartIdx)}${working.slice(
      turneBannerEndIdx + TURNE_BANNER_URL_END.length
    )}`.trim();
  }

  const turneExternalStartIdx = working.indexOf(TURNE_EXTERNAL_URL_START);
  const turneExternalEndIdx = working.indexOf(TURNE_EXTERNAL_URL_END);
  if (
    turneExternalStartIdx !== -1 &&
    turneExternalEndIdx !== -1 &&
    turneExternalEndIdx > turneExternalStartIdx
  ) {
    turneExternalUrl = working
      .slice(turneExternalStartIdx + TURNE_EXTERNAL_URL_START.length, turneExternalEndIdx)
      .trim();
    working = `${working.slice(0, turneExternalStartIdx)}${working.slice(
      turneExternalEndIdx + TURNE_EXTERNAL_URL_END.length
    )}`.trim();
  }

  const startIdx = working.indexOf(GALLERY_START);
  const endIdx = working.indexOf(GALLERY_END);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    const content = working.trim();
    const fallbackSocials = extractSocialsFromText(content);
    return {
      content,
      gallery: [],
      socials: {
        youtube: socials.youtube || fallbackSocials.youtube,
        spotify: socials.spotify || fallbackSocials.spotify,
        instagram: socials.instagram || fallbackSocials.instagram,
        website: socials.website || fallbackSocials.website,
      },
      videoUrls,
      cardText,
      cardLines,
      turneInfoTitle,
      turneInfoText,
      turneBannerUrl,
      turneExternalUrl,
    };
  }

  const galleryBlock = working
    .slice(startIdx + GALLERY_START.length, endIdx)
    .trim();

  const gallery = galleryBlock
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawPosition, ...rawUrlParts] = line.split("|");
      if (rawUrlParts.length === 0) {
        return {
          position: "top" as ArtistGalleryPosition,
          url: rawPosition.trim(),
        };
      }

      const url = rawUrlParts.join("|").trim();
      return {
        position: normalizePosition(rawPosition),
        url,
      };
    })
    .filter((item) => Boolean(item.url))
    .slice(0, MAX_GALLERY_ITEMS);

  const content = working.slice(endIdx + GALLERY_END.length).trim();
  const fallbackSocials = extractSocialsFromText(content);
  return {
    content,
    gallery,
    socials: {
      youtube: socials.youtube || fallbackSocials.youtube,
      spotify: socials.spotify || fallbackSocials.spotify,
      instagram: socials.instagram || fallbackSocials.instagram,
      website: socials.website || fallbackSocials.website,
    },
    videoUrls,
    cardText,
    cardLines,
    turneInfoTitle,
    turneInfoText,
    turneBannerUrl,
    turneExternalUrl,
  };
}

export type ArtistCardSettings = {
  text?: string;
  lines?: number;
};

export type ArtistVideoSettings = {
  url?: string; // legacy single video support
  urls?: string[];
};

export type ArtistTurneSettings = {
  infoTitle?: string;
  infoText?: string;
  bannerUrl?: string;
  externalUrl?: string;
};

export function buildArtistBio(
  content: string,
  gallery: ArtistGalleryItem[],
  socials?: ArtistSocialLinks,
  cardSettings?: ArtistCardSettings,
  videoSettings?: ArtistVideoSettings,
  turneSettings?: ArtistTurneSettings
): string {
  const normalizedGallery = gallery
    .map((item) => ({
      url: item.url.trim(),
      position: normalizePosition(item.position),
    }))
    .filter((item) => Boolean(item.url))
    .slice(0, MAX_GALLERY_ITEMS);

  const cleanedContent = content.trim();
  const socialLines = [
    socials?.youtube ? `youtube:${socials.youtube.trim()}` : "",
    socials?.spotify ? `spotify:${socials.spotify.trim()}` : "",
    socials?.instagram ? `instagram:${socials.instagram.trim()}` : "",
    socials?.website ? `website:${socials.website.trim()}` : "",
  ].filter(Boolean);
  const normalizedCardText = cardSettings?.text?.trim() || "";
  const normalizedCardLines = normalizeCardLines(cardSettings?.lines);
  const normalizedVideoUrls = (
    videoSettings?.urls && videoSettings.urls.length > 0
      ? videoSettings.urls
      : videoSettings?.url
        ? [videoSettings.url]
        : []
  )
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 5);
  const normalizedTurneInfoTitle = turneSettings?.infoTitle?.trim() || "";
  const normalizedTurneInfoText = turneSettings?.infoText?.trim() || "";
  const normalizedTurneBannerUrl = turneSettings?.bannerUrl?.trim() || "";
  const normalizedTurneExternalUrl = turneSettings?.externalUrl?.trim() || "";

  if (
    normalizedGallery.length === 0 &&
    socialLines.length === 0 &&
    normalizedVideoUrls.length === 0 &&
    !normalizedCardText &&
    normalizedCardLines === 3 &&
    !normalizedTurneInfoTitle &&
    !normalizedTurneInfoText &&
    !normalizedTurneBannerUrl &&
    !normalizedTurneExternalUrl
  ) {
    return cleanedContent;
  }

  const parts: string[] = [];
  if (socialLines.length > 0) {
    parts.push(SOCIAL_START, ...socialLines, SOCIAL_END, "");
  }
  if (normalizedVideoUrls.length > 0) {
    parts.push(VIDEO_LIST_START, ...normalizedVideoUrls, VIDEO_LIST_END, "");
  }
  if (normalizedCardText) {
    parts.push(CARD_TEXT_START, normalizedCardText, CARD_TEXT_END, "");
  }
  if (normalizedCardLines !== 3) {
    parts.push(CARD_LINES_START, String(normalizedCardLines), CARD_LINES_END, "");
  }
  if (normalizedTurneInfoTitle) {
    parts.push(TURNE_INFO_TITLE_START, normalizedTurneInfoTitle, TURNE_INFO_TITLE_END, "");
  }
  if (normalizedTurneInfoText) {
    parts.push(TURNE_INFO_TEXT_START, normalizedTurneInfoText, TURNE_INFO_TEXT_END, "");
  }
  if (normalizedTurneBannerUrl) {
    parts.push(TURNE_BANNER_URL_START, normalizedTurneBannerUrl, TURNE_BANNER_URL_END, "");
  }
  if (normalizedTurneExternalUrl) {
    parts.push(
      TURNE_EXTERNAL_URL_START,
      normalizedTurneExternalUrl,
      TURNE_EXTERNAL_URL_END,
      ""
    );
  }
  if (normalizedGallery.length > 0) {
    parts.push(
      GALLERY_START,
      ...normalizedGallery.map((item) => `${item.position}|${item.url}`),
      GALLERY_END,
      ""
    );
  }
  parts.push(cleanedContent);
  return parts.join("\n");
}

