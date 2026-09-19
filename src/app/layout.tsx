import type {Metadata} from 'next';
import '@/styles/globals.css';
export const metadata:Metadata={title:'GimmeABreak — Your leave, made easier',description:'Leave planning and clinical workforce coordination.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
