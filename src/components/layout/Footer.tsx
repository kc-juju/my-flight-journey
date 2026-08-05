const LINKS = [
  { label: 'Instagram', href: '#' },
  { label: 'Threads', href: '#' },
];

export function Footer() {
  return (
    <footer className="relative z-[500] w-full bg-surface-container-low py-stack-md">
      <div className="mx-auto flex max-w-container flex-col items-center justify-between gap-stack-sm px-margin-mobile md:flex-row lg:px-margin-desktop">
        <div className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          © {new Date().getFullYear()} My Flight Journey. All rights reserved.
        </div>
        <div className="flex gap-stack-md">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-on-surface-variant transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
