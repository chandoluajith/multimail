import React from 'react';
import * as Icons from 'lucide-react';

interface ServiceIconProps {
 name: string;
 className?: string;
 size?: number;
}

export const ServiceIcon: React.FC<ServiceIconProps> = ({ name, className = '', size = 20 }) => {
 // Map some known service names or manual mappings to Lucide icons
 const iconMap: { [key: string]: keyof typeof Icons } = {
 sparkles: 'Sparkles',
 cpu: 'Cpu',
 code: 'Code2',
 code2: 'Code2',
 compass: 'Compass',
 mousepointerclick: 'MousePointerClick',
 mouse: 'MousePointerClick',
 wind: 'Wind',
 layers: 'Layers',
 messagesquaretext: 'MessageSquareText',
 message: 'MessageSquareText',
 binary: 'Binary',
 database: 'Database',
 terminal: 'Terminal',
 brain: 'Brain',
 key: 'Key',
 shield: 'Shield',
 mail: 'Mail',
 zap: 'Zap',
 activity: 'Activity',
 };

 // Convert to lowercase to be case-insensitive
 const normalizedKey = name.toLowerCase().replace(/[^a-z0-9]/g, '');
 const iconName = iconMap[normalizedKey] || (name as keyof typeof Icons) || 'Cpu';

 const LucideIcon = (Icons[iconName] as React.ComponentType<{ className?: string; size?: number }>) || Icons.Cpu;

 return <LucideIcon className={className} size={size} />;
};
