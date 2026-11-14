import type { Item } from "./item.types";

/**
 * Pet companions: room items that move about on their own.
 *
 * A pet is bought in the Shop like any item (category `Pets`) and placed from the inventory
 * in edit mode. Its placed position is its home: the cell it is drawn on while editing and
 * the spot it tends to stay near. In play mode every client works out what the pet is doing
 * from the same timeline (the room item's id and the server clock), so everyone sees it do
 * the same thing without any pet traffic on the socket.
 *
 * Otherwise pets are ordinary items: a user may own several of the same kind, and a room may
 * hold any number of them.
 */

export const PetKind = {
    CAT: 'cat',
    DOG: 'dog',
    BIRD: 'bird',
} as const;

export type PetKind = (typeof PetKind)[keyof typeof PetKind];

/** The shop and inventory category pets are sold under. */
export const PET_CATEGORY = 'Pets';

/** What makes an item a pet. */
export interface ItemPet {
    kind: PetKind;
}

export function isPetItem(item: Pick<Item, 'pet'> | null | undefined): boolean {
    return !!item?.pet;
}
