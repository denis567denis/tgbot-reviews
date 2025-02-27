import { prop, getModelForClass, index } from '@typegoose/typegoose';

@index({ createdAt: -1 })
class Data {
  @prop({ required: true }) 
  public nameTg!: string;

  @prop({ required: true })
  public idTg!: string;

  @prop({ required: true })
  public message!: string;
  
  @prop({ required: true })
  public source!: string;

  @prop({ type: () => [String], required: true, index: true })
  public salesman!: string[];

  @prop({ required: true })
  public createdAt!: Date;
}

export const DataModel = getModelForClass(Data);