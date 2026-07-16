export default defineAppConfig({
  ui: {
    colors: {
      primary: 'violet',
      neutral: 'slate'
    },
    // Selects and menus are rendered in a portal, so page-level responsive
    // classes cannot prevent their labels from being clipped on narrow screens.
    select: {
      slots: {
        base: 'min-w-0',
        value: '!whitespace-normal !overflow-visible !text-clip break-words text-start',
        placeholder: '!whitespace-normal !overflow-visible !text-clip break-words text-start',
        content: 'min-w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)]',
        itemLabel: '!whitespace-normal !overflow-visible !text-clip break-words',
        itemDescription: '!whitespace-normal !overflow-visible !text-clip break-words'
      }
    },
    dropdownMenu: {
      slots: {
        content: 'min-w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)]',
        itemLabel: '!whitespace-normal !overflow-visible !text-clip break-words',
        itemDescription: '!whitespace-normal !overflow-visible !text-clip break-words'
      }
    }
  }
})
