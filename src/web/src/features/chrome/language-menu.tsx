import { CheckIcon, LanguagesIcon } from "../../components/icons";
import { Menu } from "../../components/menu";
import { languageDisplayName } from "./language";

/**
 * Header menu that picks the page language. Each language is named in
 * itself ("Français", not "French") — the reader who cannot read the
 * current language must still find their own — and carries its own `lang`
 * so assistive technology pronounces the name in it. The current language
 * is the checked radio item. Hidden below two languages: there is nothing
 * to choose. The component is controlled: `useLanguage` in the shell owns
 * resolution, storage and the URL.
 *
 * @example
 * const { language, choose } = useLanguage(languages);
 * <LanguageMenu languages={languages} language={language} onChoose={choose} />
 */
export function LanguageMenu({
  languages,
  language,
  onChoose,
}: {
  languages: readonly string[];
  language: string | undefined;
  onChoose: (language: string) => void;
}) {
  if (languages.length < 2) return null;
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Language"
        title="Language"
        className="ml-2 rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[popup-open]:bg-accent"
      >
        <LanguagesIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          align="end"
          sideOffset={4}
          className="z-50 outline-none"
        >
          <Menu.Popup className="min-w-40 rounded-md border border-input bg-popover py-1 text-sm text-foreground shadow-lg outline-none">
            <Menu.RadioGroup
              value={language}
              onValueChange={(next: string) => onChoose(next)}
            >
              {languages.map((code) => (
                <LanguageItem key={code} code={code} />
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function LanguageItem({ code }: { code: string }) {
  return (
    <Menu.RadioItem
      value={code}
      lang={code}
      closeOnClick
      className="flex cursor-default items-center gap-2 py-1.5 pr-3 pl-2 text-label outline-none select-none data-[highlighted]:bg-accent"
    >
      <span className="flex size-4 items-center justify-center">
        <Menu.RadioItemIndicator>
          <CheckIcon />
        </Menu.RadioItemIndicator>
      </span>
      {languageDisplayName(code)}
    </Menu.RadioItem>
  );
}
