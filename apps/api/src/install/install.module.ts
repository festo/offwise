import { Module } from '@nestjs/common';
import { InstallStepRunner } from './install-step-runner.service';

@Module({ providers: [InstallStepRunner], exports: [InstallStepRunner] })
export class InstallModule {}
