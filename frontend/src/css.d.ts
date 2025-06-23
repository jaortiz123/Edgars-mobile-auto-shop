/// <reference types="@types/css" />

declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}
