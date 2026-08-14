import type { PortfolioData, Snapshot } from './models';
import {
  accountTotal,
  assetQuantity,
  assetTotal,
  portfolioTotal,
  positionValue,
} from './portfolio';

export function buildSnapshot(
  data: PortfolioData,
  id: string,
  createdAt: number,
): Snapshot {
  return {
    id,
    createdAt,
    total: portfolioTotal(data),
    accounts: data.accounts.map((account) => ({
      accountId: account.id,
      name: account.name,
      total: accountTotal(account.id, data),
    })),
    assets: data.assets.map((asset) => ({
      assetId: asset.id,
      code: asset.code,
      name: asset.name,
      icon: asset.icon,
      color: asset.color,
      price: Number(asset.price),
      quantity: assetQuantity(asset.id, data.positions),
      value: assetTotal(asset.id, data),
    })),
    positions: data.positions.map((position) => {
      const account = data.accounts.find(
        ({ id: accountId }) => accountId === position.accountId,
      );
      const asset = data.assets.find(
        ({ id: assetId }) => assetId === position.assetId,
      );
      return {
        positionId: position.id,
        accountId: position.accountId,
        accountName: account?.name ?? '',
        assetId: position.assetId,
        assetCode: asset?.code ?? '',
        assetName: asset?.name ?? '',
        comment: position.comment,
        quantity: Number(position.quantity) || 0,
        price: Number(asset?.price) || 0,
        value: positionValue(position, data.assets),
      };
    }),
  };
}
