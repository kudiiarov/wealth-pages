import type { Language } from '../domain/models';

const copy = {
  ru: {
    title: 'Не удалось открыть локальную базу данных',
    body: 'Проверьте, что браузер разрешает хранение данных для этого сайта.',
    retry: 'Повторить',
  },
  en: {
    title: 'Could not open the local database',
    body: 'Check that your browser allows this site to store local data.',
    retry: 'Try again',
  },
} as const;

export function renderStartupError(
  container: HTMLElement,
  language: Language,
  retry: () => void,
): void {
  const text = copy[language];
  const section = document.createElement('section');
  section.className = 'startup-error';
  section.setAttribute('role', 'alert');

  const title = document.createElement('h1');
  title.textContent = text.title;
  const body = document.createElement('p');
  body.textContent = text.body;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text.retry;
  button.addEventListener('click', retry);

  section.append(title, body, button);
  container.replaceChildren(section);
}
