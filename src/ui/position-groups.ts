import type {
  Account,
  Asset,
  PortfolioData,
  Position,
  PositionGrouping,
} from '../domain/models';
import { positionValue } from '../domain/portfolio';

export interface PositionGroup {
  id: string;
  account?: Account;
  asset?: Asset;
  total: number;
  positions: Position[];
}

export function buildPositionGroups(
  data: PortfolioData,
  grouping: PositionGrouping,
): PositionGroup[] {
  const entities = grouping === 'accounts' ? data.accounts : data.assets;
  return entities
    .map((entity): PositionGroup => {
      const positions = data.positions
        .filter((position) =>
          grouping === 'accounts'
            ? position.accountId === entity.id
            : position.assetId === entity.id,
        )
        .sort(
          (left, right) =>
            Math.abs(positionValue(right, data.assets)) -
            Math.abs(positionValue(left, data.assets)),
        );
      return {
        id: `${grouping === 'accounts' ? 'account' : 'asset'}:${entity.id}`,
        ...(grouping === 'accounts'
          ? { account: entity as Account }
          : { asset: entity as Asset }),
        total: positions.reduce(
          (sum, position) => sum + positionValue(position, data.assets),
          0,
        ),
        positions,
      };
    })
    .filter(({ positions }) => positions.length > 0)
    .sort((left, right) => Math.abs(right.total) - Math.abs(left.total));
}
