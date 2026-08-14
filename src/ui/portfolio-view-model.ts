import type { Account, Asset, PortfolioData } from '../domain/models';
import { accountTotal, assetQuantity, assetTotal } from '../domain/portfolio';

export interface AllocationRow {
  asset: Asset;
  quantity: number;
  value: number;
}

export interface AccountOverviewRow {
  account: Account;
  value: number;
}

export function accountOverviewRows(data: PortfolioData): AccountOverviewRow[] {
  return data.accounts
    .map((account) => ({ account, value: accountTotal(account.id, data) }))
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
}

export function assetOverviewRows(data: PortfolioData): AllocationRow[] {
  return data.assets
    .map((asset) => ({
      asset,
      quantity: assetQuantity(asset.id, data.positions),
      value: assetTotal(asset.id, data),
    }))
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
}

export function allocationRows(data: PortfolioData): AllocationRow[] {
  return data.assets
    .map((asset) => ({
      asset,
      quantity: assetQuantity(asset.id, data.positions),
      value: assetTotal(asset.id, data),
    }))
    .filter(({ value }) => value !== 0)
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
}
