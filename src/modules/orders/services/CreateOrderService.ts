import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Could not find any costumer with the given id');
    }

    const existProducts = await this.productsRepository.findAllById(products);

    if (!existProducts.length) {
      throw new AppError('Could not find any products with the given ids');
    }
    const existProductsIds = existProducts.map(product => product.id);

    const checkInexistProducts = products.filter(
      product => !existProductsIds.includes(product.id),
    );

    if (checkInexistProducts.length) {
      throw new AppError(
        `Could not find product ${checkInexistProducts[0].id}`,
      );
    }

    const findProductsWithNoQuantity = products.filter(
      product =>
        existProducts.filter(p => p.id === product.id)[0].quantity <=
        product.quantity,
    );
    if (findProductsWithNoQuantity.length) {
      throw new AppError(
        `The quantity ${findProductsWithNoQuantity[0].quantity} is not available for ${findProductsWithNoQuantity[0].id}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const { order_products } = order;
    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existProducts.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));
    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
