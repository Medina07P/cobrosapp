// Marca de SGCRC: un recibo con dos flechas circulares (cobro recurrente).
// Hereda el color del texto (currentColor), así sigue el color de marca del cliente.
export default function Logo({ size = 28, className, style }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="SGCRC"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <path d="M7 3h18v26l-3-2.5-3 2.5-3-2.5-3 2.5-3-2.5L7 29z" />
      <path d="M11.2 14a5 5 0 0 1 9.1-1.6M20.5 9v3.5H17" />
      <path d="M20.8 17a5 5 0 0 1-9.1 1.6M11.5 22v-3.5H15" />
    </svg>
  )
}
