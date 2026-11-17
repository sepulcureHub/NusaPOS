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

export const IBell = icon(<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></>);
export const IGift = icon(<><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></>);
export const IIdCard = icon(<><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.5" cy="10.5" r="2"/><path d="M5.5 15.5c.5-1.4 1.6-2 3-2s2.5.6 3 2"/><path d="M14 9.5h4.5M14 12.5h4.5M14 15.5h3"/></>);
export const IHistory = icon(<><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/><path d="M12 7v5l3 2"/></>);