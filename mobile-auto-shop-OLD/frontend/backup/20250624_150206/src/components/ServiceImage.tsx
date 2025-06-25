interface Props {
  src: string
  alt: string
}

export default function ServiceImage({ src, alt }: Props) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="w-full h-auto"
    />
  )
}
