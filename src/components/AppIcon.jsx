import React from 'react';
import {
    Activity, Archive, ArrowLeft, ArrowRight, BarChart3, Bot, CandlestickChart, Check,
    ChevronDown, ClipboardList, Clock3, Copy, CopyCheck, ExternalLink, Eye, FileImage,
    HandCoins, Heart, ImagePlus, Languages, LayoutGrid, LockKeyhole, Menu, MessageSquarePlus,
    Monitor, Moon, PanelTop, RotateCcw, Scale, Search, SearchX, Settings2, ShieldCheck,
    SlidersHorizontal, Smartphone, Sparkles, Sun, TicketCheck, UserRound, UsersRound, X,
} from 'lucide-react';

const ICONS = {
    Activity, Archive, ArrowLeft, ArrowRight, BarChart3, Bot, CandlestickChart, Check,
    ChevronDown, ClipboardList, Clock3, Copy, CopyCheck, ExternalLink, Eye, FileImage,
    HandCoins, Heart, ImagePlus, Languages, LayoutGrid, LockKeyhole, Menu, MessageSquarePlus,
    Monitor, Moon, PanelTop, RotateCcw, Scale, Search, SearchX, Settings2, ShieldCheck,
    SlidersHorizontal, Smartphone, Sparkles, Sun, TicketCheck, UserRound, UsersRound, X,
};

export function AppIcon({ name, size = 18, strokeWidth = 1.8, ...props }) {
    const Icon = ICONS[name] || LayoutGrid;
    return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" {...props} />;
}
