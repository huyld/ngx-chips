import {
    HostListener,
    Component,
    ContentChild,
    Output,
    EventEmitter,
    Input,
    ElementRef,
    Renderer2
} from '@angular/core';
import { Observable } from 'rxjs/Observable';
import {
    delay,
    first,
    flatMap,
    merge,
    takeUntil,
    auditTime,
    map,
    distinctUntilChanged
} from 'rxjs/operators';
import { fromEvent } from 'rxjs/observable/fromEvent';
import { empty } from 'rxjs/observable/empty';
import detectPassiveEvents from 'detect-passive-events';

import { Ng2DropdownButton } from '../button/ng2-dropdown-button';
import { Ng2DropdownMenu } from '../menu/ng2-dropdown-menu';
import { DropdownStateService } from '../../services/dropdown-state.service';

@Component({
    selector: 'ng2-dropdown',
    templateUrl: './template.html',
    providers: [ DropdownStateService ]
})
export class Ng2Dropdown {
    // get children components
    @ContentChild(Ng2DropdownButton) public button: Ng2DropdownButton;
    @ContentChild(Ng2DropdownMenu) public menu: Ng2DropdownMenu;

    @Input() public anchorEl: ElementRef;
    @Input() public dynamicUpdate: boolean = true;
    @Input() public hideOnBlur = true;

    // outputs
    @Output() public onItemClicked: EventEmitter<string> = new EventEmitter<string>();
    @Output() public onItemSelected: EventEmitter<string> = new EventEmitter<string>();
    @Output() public onShow: EventEmitter<Ng2Dropdown> = new EventEmitter<Ng2Dropdown>();
    @Output() public onHide: EventEmitter<Ng2Dropdown> = new EventEmitter<Ng2Dropdown>();
    private onDestroy: EventEmitter<any> = new EventEmitter<any>();
    public onPositionChanged: EventEmitter<any> = new EventEmitter<any>();


    private get hostElement(): HTMLElement {
        return this['element'].nativeElement;
    }

    constructor(
        private state: DropdownStateService,
        private element: ElementRef,
        private renderer2: Renderer2
    ) {
        this.onShow
            // wait for Angular creating `a-dropdown__backdrop` element
            .pipe(
            delay(50),
            flatMap(_ => {
                // then when it got clicked
                let aObservable = fromEvent(this.hostElement.children[0], 'click').pipe(first());
                if (this.hideOnBlur) {
                    // or window got blur
                    aObservable = aObservable.pipe(merge(fromEvent(window, 'blur'), first()));
                }
                return aObservable;
            }),
            takeUntil(this.onDestroy))
            .subscribe(_ => {
                // we hide the menu
                this.hide();
            });

        this.onShow
            .pipe(
                flatMap(v => {
                    if (this.anchorEl) {
                        console.log('aaaaa this.anchorEl', this.anchorEl);

                        this.updatePost({ x: 0, y: 0 }, false);
                        let aObservable: Observable<any>;
                        if (detectPassiveEvents.hasSupport) {
                            // https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md
                            aObservable = fromEvent(window, 'scroll', { passive: true });
                        } else {
                            aObservable = fromEvent(window, 'scroll');
                        }
                        return aObservable.pipe(
                            merge(fromEvent(window, 'resize')),
                            merge(fromEvent(window, 'orientationchange')),
                            auditTime(100),
                            // merge(of(true).delay(10)),
                            delay(10),
                            takeUntil(this.onHide),
                            map(_ => {
                                console.log('aaaaaa vkjdsfnflkadfsjhfglkdsafj');

                                return this.anchorEl.nativeElement.getBoundingClientRect();
                            }),
                            map(rect => this.menu.calcPositionOffset(rect)),
                            distinctUntilChanged((x: any, y: any) => x.top === y.top && x.left === y.left),
                        );
                    }
                    return empty();
                }),
                takeUntil(this.onDestroy))
            .subscribe(v => this.updatePost(v));
    }

    /**
     * @name toggleMenu
     * @desc toggles menu visibility
     */
    public toggleMenu(position = this.button.getPosition()): void {
        this.state.menuState.isVisible ? this.hide() : this.show(position);
    }

    /**
     * - hides dropdown
     * @name hide
     */
    public hide(): void {
        this.menu.onInitUpdated = false;
        this.menu.hide();
        this.onHide.emit(this);
    }

    /**
     * - shows dropdown
     * @name show
     * @param position
     */
    public show(position = this.button.getPosition()): void {
        this.menu.show();

        // update menu position based on its button's
        this.menu.updatePosition(position);
        this.onShow.emit(this);
    }

    /**
     * @name scrollListener
     */
    @HostListener('window:scroll')
    public scrollListener() {
        if (this.state.menuState.isVisible && this.button && this.dynamicUpdate) {
            this.menu.updatePosition(this.button.getPosition());
        }
    }

    public ngOnInit() {
        this.state.dropdownState.onItemClicked.subscribe(item => {
            this.onItemClicked.emit(item);

            if (item.preventClose) {
                return;
            }

            this.hide.call(this);
        });

        if (this.button) {
            this.button.onMenuToggled.subscribe(() => {
                this.toggleMenu();
            });
        }

        this.state.dropdownState.onItemSelected.subscribe(item => this.onItemSelected.emit(item));
    }

    private updatePost(position, init = true) {
        const element = this.element.nativeElement;

        // make the menu wide as the anchor element
        if (this.button) {
            this.renderer2.setStyle(element.firstChild, 'width', `${this.button.getPosition().width}px`);
        }

        this.renderer2.setStyle(element, 'top', position.top);
        this.renderer2.setStyle(element, 'left', position.left);

        if (init) {
            this.menu.onInitUpdated = true;
        }
        this.onPositionChanged.emit();
    }
}
