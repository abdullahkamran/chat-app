import { Amount } from "./currency.types";

export interface Avatar {
    _id: string;
    eye: AvatarEye;
    hair?: AvatarHair;
    skin: AvatarSkin;
    mouth: AvatarMouth;
    tops: AvatarTops;
    bottoms: AvatarBottoms;
    headwear?: AvatarHeadwear;
    facewear?: AvatarFacewear;
    wristwear?: AvatarWristwear;
    footwear?: AvatarFootwear;
}

export interface AvatarItem {
    _id: string;
    name: string;
    description: string;
    subCategory: string;
    category: string;
    variants: Array<AvatarItemVariant>;
    isOverlappable: boolean;
}

export interface AvatarItemVariant {
    _id: string;
    name: string;
    sourceUrl: string;
    price: Amount;
    color?: string;
}

export interface AvatarEye extends AvatarItem {

}

export interface AvatarHair extends AvatarItem {

}

export interface AvatarSkin extends AvatarItem {

}

export interface AvatarMouth extends AvatarItem {

}

export interface AvatarTops extends AvatarItem {

}

export interface AvatarBottoms extends AvatarItem {

}

export interface AvatarHeadwear extends AvatarItem {

}

export interface AvatarFacewear extends AvatarItem {

}

export interface AvatarWristwear extends AvatarItem {

}

export interface AvatarFootwear extends AvatarItem {

}
