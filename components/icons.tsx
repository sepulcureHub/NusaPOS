import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const icon = (nodes: ReactNode) =>
  function Icon({ size = 20, ...props }: P) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
        {nodes}
      </svg>
    );
  };

export const IGrid = icon(<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>);
export const IRegister = icon(<><path d="M4 10h16v10H4z"/><path d="M7 10V7h10v3"/><path d="M9 4h6v3H9z"/><path d="M8 14h2m2 0h2m2 0h.01M8 17h8"/></>);
export const IBox = icon(<><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></>);
export const IReceipt = icon(<><path d="M6 2h12v20l-2-1.5-2 1.5-2-1.5L10 22l-2-1.5L6 22V2z"/><path d="M9 7h6M9 11h6M9 15h4"/></>);
export const IChart = icon(<><path d="M3 3v18h18"/><path d="M7 14l4-5 3 3 5-7"/></>);
export const IGear = icon(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>);
export const ISearch = icon(<><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></>);
export const IPlus = icon(<path d="M12 5v14M5 12h14"/>);
export const IMinus = icon(<path d="M5 12h14"/>);
export const IX = icon(<path d="M6 6l12 12M18 6L6 18"/>);
export const ICheck = icon(<path d="M4 12.5l5 5L20 6.5"/>);
export const IChevronDown = icon(<path d="M6 9l6 6 6-6"/>);
export const IChevronUp = icon(<path d="M6 15l6-6 6 6"/>);
export const IChevronLeft = icon(<path d="M15 6l-6 6 6 6"/>);
export const IChevronRight = icon(<path d="M9 6l6 6-6 6"/>);
export const ITrash = icon(<><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/><path d="M10 11v6M14 11v6"/></>);
export const IPen = icon(<path d="M17 3l4 4L8 20l-5 1 1-5L17 3z"/>);
export const IGrip = icon(<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></g>);
export const IVolume = icon(<><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></>);
export const IVolumeX = icon(<><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M16 9l5 6M21 9l-5 6"/></>);
export const IPrint = icon(<><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></>);
export const IDownload = icon(<><path d="M12 3v12M6 11l6 6 6-6"/><path d="M4 21h16"/></>);
export const IUpload = icon(<><path d="M12 15V3M6 7l6-6 6 6"/><path d="M4 21h16"/></>);
export const IFilter = icon(<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>);
export const IUndo = icon(<><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></>);
export const IPause = icon(<><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>);
export const IUser = icon(<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></>);
export const IUsers = icon(<><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.7c2.6.6 4.5 2.3 4.5 5.3"/></>);
export const IUserPlus = icon(<><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5c1.2 0 2.3.2 3.2.5"/><path d="M17 14v6M14 17h6"/></>);
export const IClock = icon(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>);
export const ICalendar = icon(<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>);
export const ITrendUp = icon(<><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>);
export const ITrendDown = icon(<><path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h7v-7"/></>);
export const IAlert = icon(<><path d="M12 3L2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/></>);
export const ISparkle = icon(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16z"/>);
export const IStore = icon(<><path d="M4 9l1.5-5h13L20 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/><path d="M9 20v-5h6v5"/></>);
export const IQR = icon(<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z"/></>);
export const ICard = icon(<><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></>);
export const ICash = icon(<><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5h.01M18 14.5h.01"/></>);
export const IMenu = icon(<path d="M4 7h16M4 12h16M4 17h16"/>);
export const ITag = icon(<><path d="M20.6 13.4L11 3H4v7l9.6 10.4a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8z"/><path d="M7.5 6.5h.01"/></>);
export const IFlame = icon(<path d="M12 22c4.4 0 7-2.8 7-6.6 0-2.8-1.6-4.9-3.2-6.6C14.3 7.2 13 5.6 13 3c-3 2-4.2 4.6-4 7-1-.4-1.8-1.2-2-2.6C5.6 9 5 11.2 5 13.4 5 19.2 7.6 22 12 22z"/>);
export const IRefresh = icon(<><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></>);
export const IBookmark = icon(<path d="M6 3h12v18l-6-4-6 4V3z"/>);
export const IArrowRight = icon(<path d="M4 12h16M13 5l7 7-7 7"/>);
export const ICart = icon(<><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.4 12h10.2L20 8H6"/></>);
export const IPercent = icon(<><path d="M19 5L5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>);
export const IInfo = icon(<><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>);
export const ICheckCircle = icon(<><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></>);
export const ISun = icon(<><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/></>);
export const IMoon = icon(<path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8z"/>);
export const IMonitor = icon(<><rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/></>);
export const IImage = icon(<><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M3.5 17l5-4.5 4 3.2 3.2-2.6 4.8 4.2"/></>);
export const IPalette = icon(<><path d="M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3.2 3H16a2 2 0 0 0-1.4 3.4A1.8 1.8 0 0 1 12 21z"/><circle cx="7.5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.8" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.4" cy="7.6" r="1.1" fill="currentColor" stroke="none"/></>);
export const IDatabase = icon(<><ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></>);
export const IShield = icon(<><path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6l8-3z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/></>);
export const IKey = icon(<><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17.5 5.5l2 2M15 8l2 2"/></>);
export const ILock = icon(<><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/></>);
export const ILogOut = icon(<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h9"/></>);
export const IEye = icon(<><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></>);
export const IEyeOff = icon(<><path d="M4 4l16 16"/><path d="M9.6 5.7A9.9 9.9 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-2.7 3.5M6.4 7.6A16.6 16.6 0 0 0 2 12s3.6 6.5 10 6.5c1.2 0 2.3-.2 3.3-.6"/><path d="M9.6 9.8a2.8 2.8 0 0 0 3.9 3.9"/></>);
export const IHeart = icon(<path d="M12 20.3l-1.4-1.3C5.4 14.4 2 11.3 2 7.6 2 4.9 4.1 3 6.7 3c1.6 0 3.2.8 4.3 2.1C12.1 3.8 13.7 3 15.3 3 17.9 3 20 4.9 20 7.6c0 3.7-3.4 6.8-8.6 11.4z"/>);
export const IMapPin = icon(<><path d="M20 10.5c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10.3" r="2.8"/></>);
export const IPhone = icon(<path d="M6.6 3h3l1.5 4-2 1.4a12 12 0 0 0 5.5 5.5l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3z"/>);
export const IStar = icon(<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>);
export const IPlay = icon(<path d="M7 4.5l12 7.5-12 7.5z"/>);
export const IStop = icon(<rect x="5.5" y="5.5" width="13" height="13" rx="2.5"/>);
export const IBell = icon(<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></>);
export const IGift = icon(<><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></>);
export const ICopy = icon(<><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>);
export const IIdCard = icon(<><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.5" cy="10.5" r="2"/><path d="M5.5 15.5c.5-1.4 1.6-2 3-2s2.5.6 3 2"/><path d="M14 9.5h4.5M14 12.5h4.5M14 15.5h3"/></>);
export const IHistory = icon(<><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/><path d="M12 7v5l3 2"/></>);