export const ANDROID_APP = import.meta.env?.VITE_INSIGHT_ANDROID === "true";
export const editorialImage = name => (import.meta.env?.BASE_URL || "/") + "editorial/" + name + ".jpg";
