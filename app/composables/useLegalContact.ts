export function useLegalContact() {
  const config = useRuntimeConfig()

  return {
    entityName: config.public.legalEntityName as string,
    supportEmail: config.public.supportEmail as string,
    supportPhone: config.public.supportPhone as string,
    legalAddress: config.public.legalAddress as string,
  }
}
