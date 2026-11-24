// nucleo ui icons (nucleoapp.com, free set), strokes switched to currentColor

type P = { className?: string }

export const Sliders = ({ className }: P) => (
  <svg viewBox="0 0 12 12" className={className}><line x1="11.25" y1="8.75" x2="6.25" y2="8.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><circle cx="4.25" cy="8.75" r="2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></circle><line x1="2.25" y1="8.75" x2=".75" y2="8.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1=".75" y1="3.25" x2="5.75" y2="3.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><circle cx="7.75" cy="3.25" r="2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></circle><line x1="9.75" y1="3.25" x2="11.25" y2="3.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line></svg>
)

export const Crosshairs = ({ className }: P) => (
  <svg viewBox="0 0 18 18" className={className}><circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></circle><circle cx="9" cy="9" r="2.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></circle><line x1="9" y1="1" x2="9" y2="2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="17" y1="9" x2="15.5" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="9" y1="17" x2="9" y2="15.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="1" y1="9" x2="2.5" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line></svg>
)

export const Layers = ({ className }: P) => (
  <svg viewBox="0 0 18 18" className={className}><path d="M2.665,5.086L8.534,1.995c.292-.154,.64-.154,.932,0l5.87,3.091c.534,.281,.534,1.046,0,1.327l-5.87,3.091c-.292,.154-.64,.154-.932,0L2.665,6.414c-.534-.281-.534-1.046,0-1.327Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><path d="M15.736,9c0,.261-.134,.523-.401,.664l-5.87,3.091c-.292,.154-.64,.154-.932,0l-5.87-3.091c-.267-.141-.401-.402-.401-.664" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><path d="M15.736,12.25c0,.261-.134,.523-.401,.664l-5.87,3.091c-.292,.154-.64,.154-.932,0l-5.87-3.091c-.267-.141-.401-.402-.401-.664" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path></svg>
)

export const EyeOpen = ({ className }: P) => (
  <svg viewBox="0 0 18 18" className={className}><path d="M1.859,8c1.815-1.851,4.344-3,7.141-3s5.326,1.148,7.141,3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><circle cx="9" cy="10.5" r="2.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></circle><line x1="4.021" y1="6.328" x2="2.75" y2="4.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="7.3" y1="5.144" x2="6.823" y2="2.769" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="13.979" y1="6.328" x2="15.25" y2="4.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="10.7" y1="5.144" x2="11.177" y2="2.769" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line></svg>
)

export const EyeClosed = ({ className }: P) => (
  <svg viewBox="0 0 18 18" className={className}><path d="M1.859,7.27c1.815,1.851,4.344,3,7.141,3s5.326-1.148,7.141-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><line x1="4.021" y1="8.942" x2="2.75" y2="11.019" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="7.3" y1="10.126" x2="6.823" y2="12.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="13.979" y1="8.942" x2="15.25" y2="11.019" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="10.7" y1="10.126" x2="11.177" y2="12.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line></svg>
)

export const Magnifier = ({ className }: P) => (
  <svg viewBox="0 0 12 12" className={className}><line x1="7.652" y1="7.652" x2="10.75" y2="10.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></circle></svg>
)

export const Box = ({ className }: P) => (
  <svg viewBox="0 0 12 12" className={className}><line x1="1.25" y1="3.75" x2="10.75" y2="3.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="6" y1=".75" x2="6" y2="3.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="3.75" y1="8.25" x2="5.25" y2="8.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><path d="m1.25,3.75l1.461-2.504c.179-.307.508-.496.864-.496h4.851c.356,0,.685.189.864.496l1.461,2.504v5c0,1.105-.895,2-2,2H3.25c-1.105,0-2-.895-2-2V3.75Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path></svg>
)

export const Pointer = ({ className }: P) => (
  <svg viewBox="0 0 12 12" className={className}><path d="m1.455.814l9.367,3.422c.447.163.434.801-.019.946l-4.258,1.363-1.363,4.258c-.145.454-.782.467-.946.019L.814,1.455c-.146-.399.242-.787.641-.641Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path></svg>
)

export const Folder = ({ className }: P) => (
  <svg viewBox="0 0 12 12" className={className}><path d="m.75,7.25V3.25c0-1.105.895-2,2-2h1.701c.607,0,1.18.275,1.56.748l.603.752h2.636c1.105,0,2,.895,2,2v2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><path d="m2.75,5.25h6.5c1.105,0,2,.895,2,2v1.5c0,1.105-.895,2-2,2H2.75c-1.105,0-2-.895-2-2v-1.5c0-1.105.895-2,2-2Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path></svg>
)

export const Bolt = ({ className }: P) => (
  <svg viewBox="0 0 12 12" className={className}><path d="m5.417,11.25l4.833-6.5h-4l.333-4L1.75,7.25h4l-.333,4Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path></svg>
)

export const Xmark = ({ className }: P) => (
  <svg viewBox="0 0 12 12" className={className}><line x1="2.25" y1="9.75" x2="9.75" y2="2.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line><line x1="9.75" y1="9.75" x2="2.25" y2="2.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></line></svg>
)

export const Wand = ({ className }: P) => (
  <svg viewBox="0 0 18 18" className={className}><path d="M2.5 15.5L9.75449 8.24542" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"></path><path d="M8.8428 2L11.6329 3.82147L14.7153 2.55713L13.8445 5.77307L16 8.31268L12.6731 8.47852L10.9231 11.314L9.7374 8.20062L6.5 7.41333L9.09451 5.32208L8.8428 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"></path></svg>
)

export const Target = ({ className }: P) => (
  <svg viewBox="0 0 18 18" className={className}><path d="M9 9L12.25 5.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"></path><path d="M12.25 5.75L11.5 3.5L14 1L14.75 3.25L17 4L14.5 6.5L12.25 5.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"></path><path d="M8.757 4.75677C6.5231 4.88277 4.75 6.7346 4.75 9C4.75 11.3469 6.653 13.25 9 13.25C11.2653 13.25 13.1171 11.477 13.2432 9.24323" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"></path><path d="M9.06329 1.75031C9.04219 1.75011 9.0212 1.75 9 1.75C4.996 1.75 1.75 4.9961 1.75 9C1.75 13.0039 4.996 16.25 9 16.25C13.004 16.25 16.25 13.0039 16.25 9C16.25 8.9788 16.2499 8.95772 16.2497 8.93652" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"></path></svg>
)
