// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  readAccountForm,
  readAssetEditForm,
  readAssetForm,
  readPositionForm,
} from '../../src/ui/forms';

function form(markup: string): HTMLFormElement {
  document.body.innerHTML = `<form id="subject">${markup}</form>`;
  return document.querySelector<HTMLFormElement>('#subject')!;
}

describe('form readers', () => {
  it('trims account fields and preserves the selected type', () => {
    const input = readAccountForm(
      form(`
        <input name="name" value=" Cash ">
        <select name="type"><option value="cash" selected>Cash</option></select>
        <input name="icon" value=" $ ">
        <input name="color" value="#17181b">
      `),
    );

    expect(input).toEqual({
      name: 'Cash',
      type: 'cash',
      icon: '$',
      color: '#17181b',
    });
  });

  it('rejects invalid asset prices before a use case is called', () => {
    const input = readAssetForm(
      form(`
        <input name="name" value="Dollar">
        <input name="code" value="usd">
        <input name="icon" value="$">
        <input name="color" value="#5667ff">
        <input name="price" value="not-a-number">
        <select name="autoUpdateSource"><option value="none" selected>None</option></select>
      `),
    );

    expect(input).toBeNull();
  });

  it('reads asset edit metadata while preserving its canonical price', () => {
    const input = readAssetEditForm(
      form(`
        <input name="name" value=" Euro ">
        <input name="code" value="eur">
        <input name="icon" value="€">
        <input name="color" value="#5667ff">
        <select name="autoUpdateSource"><option value="frankfurter" selected>Frankfurter</option></select>
      `),
      1.1,
    );

    expect(input).toEqual({
      name: 'Euro',
      code: 'EUR',
      icon: '€',
      color: '#5667ff',
      price: 1.1,
      autoUpdateSource: 'frankfurter',
    });
  });

  it('returns a new position input every time when no edit id is present', () => {
    const positionForm = form(`
      <select name="accountId"><option value="a" selected>Cash</option></select>
      <select name="assetId"><option value="usd" selected>USD</option></select>
      <input name="quantity" value="2,5">
      <input name="comment" value=" reserve ">
    `);

    expect(readPositionForm(positionForm)).toEqual({
      accountId: 'a',
      assetId: 'usd',
      quantity: 2.5,
      comment: 'reserve',
    });
    expect(readPositionForm(positionForm)).not.toHaveProperty('id');
  });
});
