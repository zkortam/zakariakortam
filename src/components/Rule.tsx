export function Rule({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" data-rule="" className={`rule ${className}`} />
}
