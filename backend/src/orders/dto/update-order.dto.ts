import { PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto.js';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
