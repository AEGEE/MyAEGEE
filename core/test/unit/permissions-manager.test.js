const PermissionManager = require('../../lib/permissions-manager');

// A tree of circles:
//   1
//   ├── 2
//   │   ├── 4
//   │   │   └── 6
//   │   └── 5
//   └── 3
//   7 (on its own)
const CIRCLES = [
    { id: 1, parent_circle_id: null },
    { id: 2, parent_circle_id: 1 },
    { id: 3, parent_circle_id: 1 },
    { id: 4, parent_circle_id: 2 },
    { id: 5, parent_circle_id: 2 },
    { id: 6, parent_circle_id: 4 },
    { id: 7, parent_circle_id: null }
];

describe('Permission manager', () => {
    let manager;

    beforeEach(() => {
        manager = new PermissionManager({ user: { id: 1 } });
        manager.addCircles(CIRCLES);
    });

    describe('getIndirectChildCircles', () => {
        test('should return every circle below the circle once', () => {
            const children = manager.getIndirectChildCircles(1);

            expect([...children].sort()).toEqual([2, 3, 4, 5, 6]);
        });

        test('should return the circles below a circle in the middle of the tree', () => {
            expect([...manager.getIndirectChildCircles(2)].sort()).toEqual([4, 5, 6]);
        });

        test('should return nothing for a circle without child circles', () => {
            expect(manager.getIndirectChildCircles(6)).toEqual([]);
            expect(manager.getIndirectChildCircles(7)).toEqual([]);
        });
    });

    describe('getIndirectParentCircles', () => {
        test('should return the circle and every circle above it', () => {
            expect(manager.getIndirectParentCircles(6)).toEqual([6, 4, 2, 1]);
            expect(manager.getIndirectParentCircles(7)).toEqual([7]);
        });
    });

    describe('addCircles', () => {
        test('should keep a circle that is added twice once', () => {
            manager.addCircles([{ id: 1, parent_circle_id: null }, { id: 8, parent_circle_id: 7 }]);

            expect(manager.circles.length).toEqual(8);
            expect(manager.getIndirectChildCircles(7)).toEqual([8]);
        });
    });
});
