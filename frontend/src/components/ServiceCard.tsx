import type { Service as BaseService } from '../api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/Card';
import { Button } from './ui/Button';
import { Wrench } from 'lucide-react';

interface Props<T extends BaseService = BaseService> {
  service: T;
  onSelect: (service: T) => void;
  displayPrice?: boolean;
}

export default function ServiceCard<T extends BaseService = BaseService>({ service, onSelect, displayPrice = false }: Props<T>) {
  return (
    <Card 
      className="card-base flex flex-col h-full cursor-pointer min-h-[320px]" 
      onClick={() => onSelect(service)}
      data-testid={`service-card-${service.id}`}
    >
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-primary mb-4 border shadow-sm">
            <Wrench className="h-6 w-6" />
        </div>
        <CardTitle>{service.name}</CardTitle>
        <CardDescription>{service.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {displayPrice && (
            <div>
                <span className="text-fs-1 text-muted-foreground">From</span>
                <p className="text-fs-6 font-extrabold text-primary">${service.base_price}</p>
            </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full font-bold">
          Select & Continue →
        </Button>
      </CardFooter>
    </Card>
  );
}
